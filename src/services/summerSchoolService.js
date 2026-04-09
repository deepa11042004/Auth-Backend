const crypto = require('crypto');
const Razorpay = require('razorpay');

const StudentRegistration = require('../models/StudentRegistration');

const SUMMER_SCHOOL_REGISTRATION_FEES = Object.freeze({
  Indian: {
    amount: 1750,
    currency: 'INR',
  },
  Other: {
    amount: 150,
    currency: 'USD',
  },
});

const SUCCESSFUL_PAYMENT_STATUSES = new Set(['captured', 'authorized']);
const TRANSIENT_PAYMENT_STATUSES = new Set(['created', 'pending']);
const PAYMENT_FETCH_RETRY_ATTEMPTS = 6;
const PAYMENT_FETCH_RETRY_DELAY_MS = 1200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function toMoneyInMinorUnits(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric * 100);
}

function normalizeNationality(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'indian') {
    return 'Indian';
  }

  if (normalized === 'other' || normalized === 'others') {
    return 'Other';
  }

  return '';
}

function resolveSummerSchoolPaymentConfig(nationality) {
  const normalizedNationality = normalizeNationality(nationality);
  if (!normalizedNationality) {
    return null;
  }

  const registrationFee = SUMMER_SCHOOL_REGISTRATION_FEES[normalizedNationality];
  if (!registrationFee) {
    return null;
  }

  return {
    nationality: normalizedNationality,
    amount: registrationFee.amount,
    currency: registrationFee.currency,
  };
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

async function registerStudent(payload) {
  await StudentRegistration.ensureStudentRegistrationTable();

  const {
    payload: normalizedPayload,
    errors,
  } = StudentRegistration.normalizeStudentRegistrationPayload(payload || {});

  if (errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        message: errors.join('. '),
        errors,
      },
    };
  }

  const registration = await StudentRegistration.createStudentRegistration(
    normalizedPayload
  );

  return {
    status: 200,
    body: {
      success: true,
      message: 'Student registration submitted successfully',
      data: registration,
    },
  };
}

async function createPaymentOrder(payload) {
  await StudentRegistration.ensureStudentRegistrationTable();

  const email = normalizeEmail(payload?.email);
  const paymentConfig = resolveSummerSchoolPaymentConfig(payload?.nationality);

  if (!email) {
    return {
      status: 400,
      body: { message: 'email is required' },
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      status: 400,
      body: { message: 'Invalid email format' },
    };
  }

  if (!paymentConfig) {
    return {
      status: 400,
      body: { message: 'nationality must be Indian or Other' },
    };
  }

  if (await StudentRegistration.isStudentEmailTaken(email)) {
    return {
      status: 200,
      body: {
        requires_payment: false,
        already_registered: true,
        amount: 0,
        currency: paymentConfig.currency,
        message: 'Email already registered for summer school.',
      },
    };
  }

  const amountInMinorUnits = toMoneyInMinorUnits(paymentConfig.amount);
  if (amountInMinorUnits === null || amountInMinorUnits <= 0) {
    return {
      status: 500,
      body: { message: 'Invalid summer school registration fee configuration' },
    };
  }

  const { keyId } = getRazorpayCredentials();
  const razorpayClient = getRazorpayClient();

  if (!keyId || !razorpayClient) {
    return {
      status: 500,
      body: { message: 'Razorpay credentials are missing on the server' },
    };
  }

  const order = await razorpayClient.orders.create({
    amount: amountInMinorUnits,
    currency: paymentConfig.currency,
    receipt: `summer_school_student_${Date.now()}`,
    notes: {
      source: 'summer_school_student_registration',
      applicant_email: email,
      nationality: paymentConfig.nationality,
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
      registration_fee: paymentConfig.amount,
      nationality: paymentConfig.nationality,
    },
  };
}

async function verifyPaymentAndRegister(payload) {
  await StudentRegistration.ensureStudentRegistrationTable();

  const {
    payload: normalizedPayload,
    errors,
  } = StudentRegistration.normalizeStudentRegistrationPayload(payload || {});

  if (errors.length > 0) {
    return {
      status: 400,
      body: {
        message: errors.join('. '),
        errors,
      },
    };
  }

  const orderId = cleanText(payload?.razorpay_order_id);
  const paymentId = cleanText(payload?.razorpay_payment_id);
  const signature = cleanText(payload?.razorpay_signature);

  if (!orderId || !paymentId || !signature) {
    return {
      status: 400,
      body: {
        message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
      },
    };
  }

  const paymentConfig = resolveSummerSchoolPaymentConfig(normalizedPayload.nationality);
  if (!paymentConfig) {
    return {
      status: 400,
      body: { message: 'nationality must be Indian or Other' },
    };
  }

  const amountInMinorUnits = toMoneyInMinorUnits(paymentConfig.amount);
  if (amountInMinorUnits === null || amountInMinorUnits <= 0) {
    return {
      status: 400,
      body: { message: 'Payment is not required for this registration' },
    };
  }

  const { keySecret } = getRazorpayCredentials();
  const razorpayClient = getRazorpayClient();

  if (!keySecret || !razorpayClient) {
    return {
      status: 500,
      body: { message: 'Razorpay credentials are missing on the server' },
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

  if (String(payment.order_id) !== orderId) {
    return {
      status: 400,
      body: { message: 'Payment does not belong to this order' },
    };
  }

  if (Number(payment.amount) !== amountInMinorUnits) {
    return {
      status: 400,
      body: { message: 'Paid amount does not match summer school registration fee' },
    };
  }

  const paymentCurrency = cleanText(payment.currency).toUpperCase();
  if (paymentCurrency !== paymentConfig.currency) {
    return {
      status: 400,
      body: {
        message: `Payment currency mismatch. Expected ${paymentConfig.currency}, received ${paymentCurrency || 'unknown'}`,
      },
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

  if (await StudentRegistration.isStudentEmailTaken(normalizedPayload.email)) {
    return {
      status: 200,
      body: {
        success: true,
        message: 'Payment verified. Email already registered for summer school.',
        payment: {
          amount: Number(payment.amount) / 100,
          currency: paymentCurrency,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          status: cleanText(payment.status) || 'captured',
          mode: cleanText(payment.method) || null,
        },
      },
    };
  }

  const registration = await StudentRegistration.createStudentRegistration({
    ...normalizedPayload,
    payment_amount: Number(payment.amount) / 100,
    payment_currency: paymentCurrency,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    payment_status: cleanText(payment.status) || 'captured',
    payment_mode: cleanText(payment.method) || null,
  });

  return {
    status: 201,
    body: {
      success: true,
      message: 'Payment verified and student registration submitted successfully',
      data: registration,
      payment: {
        amount: Number(payment.amount) / 100,
        currency: paymentCurrency,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        status: cleanText(payment.status) || 'captured',
        mode: cleanText(payment.method) || null,
      },
    },
  };
}

async function listStudentRegistrations() {
  await StudentRegistration.ensureStudentRegistrationTable();
  const registrations = await StudentRegistration.getStudentRegistrations();

  return {
    status: 200,
    body: {
      success: true,
      data: registrations,
    },
  };
}

module.exports = {
  registerStudent,
  createPaymentOrder,
  verifyPaymentAndRegister,
  listStudentRegistrations,
};