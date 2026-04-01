const crypto = require('crypto');
const Razorpay = require('razorpay');

const db = require('../config/db');
const roles = require('../constants/roles');
const { hashPassword } = require('../utils/hashPassword');

const REGISTRATION_TABLE = 'workshop_registrations';
const WORKSHOP_TABLE = 'workshop_list';
const DEFAULT_WORKSHOP_ID = 1;
const PAYMENT_CURRENCY = 'INR';
const SUCCESSFUL_PAYMENT_STATUSES = new Set(['captured', 'authorized']);
const TRANSIENT_PAYMENT_STATUSES = new Set(['created', 'pending']);
const PAYMENT_FETCH_RETRY_ATTEMPTS = 6;
const PAYMENT_FETCH_RETRY_DELAY_MS = 1200;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DESIGNATIONS = new Set(['Student', 'Faculty', 'Professional']);

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = cleanText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function normalizeDesignation(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'student') {
    return 'Student';
  }
  if (normalized === 'faculty') {
    return 'Faculty';
  }
  if (normalized === 'professional') {
    return 'Professional';
  }
  return '';
}

function toPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function resolveWorkshopId(input) {
  const raw =
    input.workshop_id !== undefined
      ? input.workshop_id
      : input.workshopId !== undefined
      ? input.workshopId
      : DEFAULT_WORKSHOP_ID;

  return toPositiveInt(raw);
}

function toMoneyInPaise(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric * 100);
}

function getRazorpayCredentials() {
  return {
    keyId: cleanText(process.env.RAZORPAY_KEY_ID),
    keySecret: cleanText(process.env.RAZORPAY_KEY_SECRET),
  };
}

function getRazorpayClient() {
  const { keyId, keySecret } = getRazorpayCredentials();
  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function isValidRazorpaySignature({ orderId, paymentId, signature, keySecret }) {
  if (!orderId || !paymentId || !signature || !keySecret) {
    return false;
  }

  if (!/^[0-9a-f]+$/i.test(signature)) {
    return false;
  }

  const digest = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expected = Buffer.from(digest, 'hex');
  const received = Buffer.from(signature.toLowerCase(), 'hex');

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPaymentFromRazorpayWithRetry(razorpayClient, paymentId) {
  let lastError = null;
  let latestPayment = null;

  for (let attempt = 1; attempt <= PAYMENT_FETCH_RETRY_ATTEMPTS; attempt += 1) {
    try {
      latestPayment = await razorpayClient.payments.fetch(paymentId);

      const paymentStatus = cleanText(latestPayment?.status).toLowerCase();
      if (latestPayment && !TRANSIENT_PAYMENT_STATUSES.has(paymentStatus)) {
        return { payment: latestPayment, fetchError: null };
      }
    } catch (err) {
      lastError = err;
    }

    if (attempt < PAYMENT_FETCH_RETRY_ATTEMPTS) {
      await wait(PAYMENT_FETCH_RETRY_DELAY_MS);
    }
  }

  return { payment: latestPayment, fetchError: lastError };
}

async function getWorkshopById(workshopId, connection = db) {
  const [rows] = await connection.query(
    `SELECT id, title, fee FROM ${WORKSHOP_TABLE} WHERE id = ? LIMIT 1`,
    [workshopId]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    id: Number(rows[0].id),
    title: cleanText(rows[0].title) || `Workshop ${workshopId}`,
    fee: rows[0].fee,
  };
}

async function hasExistingRegistration(workshopId, email, connection = db) {
  const [rows] = await connection.query(
    `SELECT id FROM ${REGISTRATION_TABLE} WHERE workshop_id = ? AND email = ? LIMIT 1`,
    [workshopId, email]
  );

  return Boolean(rows[0]);
}

async function createPaymentOrder(input) {
  const workshopId = resolveWorkshopId(input || {});
  if (!workshopId) {
    return {
      status: 400,
      body: { message: 'workshop_id is required and must be a positive integer' },
    };
  }

  const workshop = await getWorkshopById(workshopId);
  if (!workshop) {
    return {
      status: 404,
      body: { message: 'Workshop not found' },
    };
  }

  const payerEmail = normalizeEmail(input?.email);
  if (payerEmail && !EMAIL_REGEX.test(payerEmail)) {
    return {
      status: 400,
      body: { message: 'Invalid email format' },
    };
  }

  if (payerEmail && (await hasExistingRegistration(workshopId, payerEmail))) {
    return {
      status: 200,
      body: {
        requires_payment: false,
        already_registered: true,
        amount: 0,
        currency: PAYMENT_CURRENCY,
        workshop_id: workshopId,
        workshop_title: workshop.title,
        message: 'You have already registered for this workshop',
      },
    };
  }

  const amountInPaise = toMoneyInPaise(workshop.fee);
  if (amountInPaise === null) {
    return {
      status: 400,
      body: { message: 'Invalid workshop fee configured for this workshop' },
    };
  }

  if (amountInPaise <= 0) {
    return {
      status: 200,
      body: {
        requires_payment: false,
        amount: 0,
        currency: PAYMENT_CURRENCY,
        workshop_id: workshopId,
        workshop_title: workshop.title,
      },
    };
  }

  const { keyId } = getRazorpayCredentials();
  const razorpayClient = getRazorpayClient();

  if (!keyId || !razorpayClient) {
    return {
      status: 500,
      body: {
        message: 'Razorpay credentials are missing on the server',
      },
    };
  }

  const order = await razorpayClient.orders.create({
    amount: amountInPaise,
    currency: PAYMENT_CURRENCY,
    receipt: `workshop_${workshopId}_${Date.now()}`,
    notes: {
      workshop_id: String(workshopId),
    },
  });

  return {
    status: 201,
    body: {
      requires_payment: true,
      key_id: keyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      workshop_id: workshopId,
      workshop_title: workshop.title,
    },
  };
}

async function verifyPaymentAndRegister(input) {
  const workshopId = resolveWorkshopId(input || {});
  if (!workshopId) {
    return {
      status: 400,
      body: { message: 'workshop_id is required and must be a positive integer' },
    };
  }

  const orderId = cleanText(input.razorpay_order_id);
  const paymentId = cleanText(input.razorpay_payment_id);
  const signature = cleanText(input.razorpay_signature);

  if (!orderId || !paymentId || !signature) {
    return {
      status: 400,
      body: {
        message:
          'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
      },
    };
  }

  const workshop = await getWorkshopById(workshopId);
  if (!workshop) {
    return {
      status: 404,
      body: { message: 'Workshop not found' },
    };
  }

  const amountInPaise = toMoneyInPaise(workshop.fee);
  if (amountInPaise === null || amountInPaise <= 0) {
    return {
      status: 400,
      body: { message: 'Payment is not required for this workshop' },
    };
  }

  const { keySecret } = getRazorpayCredentials();
  const razorpayClient = getRazorpayClient();

  if (!keySecret || !razorpayClient) {
    return {
      status: 500,
      body: {
        message: 'Razorpay credentials are missing on the server',
      },
    };
  }

  const validSignature = isValidRazorpaySignature({
    orderId,
    paymentId,
    signature,
    keySecret,
  });

  if (!validSignature) {
    return {
      status: 400,
      body: { message: 'Invalid payment signature' },
    };
  }

  const { payment, fetchError } = await fetchPaymentFromRazorpayWithRetry(
    razorpayClient,
    paymentId
  );

  if (!payment) {
    const reason = fetchError instanceof Error ? cleanText(fetchError.message) : '';
    return {
      status: 400,
      body: {
        message: 'Unable to validate payment with Razorpay',
        ...(reason ? { reason } : {}),
      },
    };
  }

  if (!payment || String(payment.order_id) !== orderId) {
    return {
      status: 400,
      body: { message: 'Payment does not belong to this order' },
    };
  }

  if (Number(payment.amount) !== amountInPaise) {
    return {
      status: 400,
      body: { message: 'Paid amount does not match workshop fee' },
    };
  }

  const paymentStatus = cleanText(payment.status).toLowerCase();
  if (!SUCCESSFUL_PAYMENT_STATUSES.has(paymentStatus)) {
    return {
      status: 400,
      body: {
        message: `Payment is not successful yet (status: ${paymentStatus || 'unknown'})`,
      },
    };
  }

  const registrationResult = await registerForWorkshop({
    ...input,
    workshop_id: workshopId,
  });

  if (registrationResult.status !== 201) {
    if (registrationResult.status === 409) {
      return {
        status: 200,
        body: {
          message: 'Payment verified. You are already registered for this workshop',
          registration: {
            workshop_id: workshopId,
            email: normalizeEmail(input.email),
          },
          payment: {
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            status: payment.status,
          },
        },
      };
    }

    return registrationResult;
  }

  return {
    status: 201,
    body: {
      message: 'Payment verified and workshop registration successful',
      registration: registrationResult.body.registration,
      payment: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        status: payment.status,
      },
    },
  };
}

async function registerForWorkshop(input) {
  const fullName = cleanText(input.full_name);
  const email = normalizeEmail(input.email);
  const contactNumber = cleanText(input.contact_number);
  const alternativeEmail = normalizeEmail(input.alternative_email) || null;
  const institution = cleanText(input.institution);
  const designation = normalizeDesignation(input.designation);
  const agreeRecording = toBoolean(input.agree_recording);
  const agreeTerms = toBoolean(input.agree_terms);
  const workshopId = resolveWorkshopId(input || {});

  if (!workshopId) {
    return {
      status: 400,
      body: { message: 'workshop_id is required and must be a positive integer' },
    };
  }

  if (!fullName || !email || !contactNumber || !institution || !designation) {
    return {
      status: 400,
      body: {
        message:
          'full_name, email, contact_number, institution and designation are required',
      },
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      status: 400,
      body: { message: 'Invalid email format' },
    };
  }

  if (alternativeEmail && !EMAIL_REGEX.test(alternativeEmail)) {
    return {
      status: 400,
      body: { message: 'Invalid alternative_email format' },
    };
  }

  if (!ALLOWED_DESIGNATIONS.has(designation)) {
    return {
      status: 400,
      body: { message: 'designation must be Student, Faculty, or Professional' },
    };
  }

  if (!agreeRecording || !agreeTerms) {
    return {
      status: 400,
      body: { message: 'agree_recording and agree_terms must be true' },
    };
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [workshopRows] = await connection.query(
      `SELECT id FROM ${WORKSHOP_TABLE} WHERE id = ? LIMIT 1`,
      [workshopId]
    );

    if (!workshopRows[0]) {
      await connection.rollback();
      return {
        status: 404,
        body: { message: 'Workshop not found' },
      };
    }

    try {
      await connection.query(
        `INSERT INTO ${REGISTRATION_TABLE} (
          workshop_id,
          full_name,
          email,
          contact_number,
          alternative_email,
          institution,
          designation,
          agree_recording,
          agree_terms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workshopId,
          fullName,
          email,
          contactNumber,
          alternativeEmail,
          institution,
          designation,
          agreeRecording,
          agreeTerms,
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        await connection.rollback();
        return {
          status: 409,
          body: { message: 'You have already registered for this workshop' },
        };
      }
      throw err;
    }

    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!existingUsers[0]) {
      const hashedPassword = await hashPassword(contactNumber);

      try {
        await connection.query(
          'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
          [fullName, email, hashedPassword, roles.USER]
        );
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') {
          throw err;
        }
      }
    }

    await connection.commit();

    return {
      status: 201,
      body: {
        message: 'Workshop registration successful',
        registration: {
          workshop_id: workshopId,
          email,
        },
      },
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  createPaymentOrder,
  verifyPaymentAndRegister,
  registerForWorkshop,
};
