const crypto = require('crypto');
const Razorpay = require('razorpay');

const db = require('../config/db');
const roles = require('../constants/roles');
const { hashPassword } = require('../utils/hashPassword');

const INTERNSHIP_TABLE = 'summer_internship_registrations';
const INTERNSHIP_FEE_SETTINGS_TABLE = 'summer_internship_fee_settings';
const PAYMENT_CURRENCY = 'INR';
const DEFAULT_GENERAL_INTERNSHIP_FEE_RUPEES = 100;
const DEFAULT_LATERAL_INTERNSHIP_FEE_RUPEES = 100;
const SUCCESSFUL_PAYMENT_STATUSES = new Set(['captured', 'authorized']);
const TRANSIENT_PAYMENT_STATUSES = new Set(['created', 'pending']);
const PAYMENT_FETCH_RETRY_ATTEMPTS = 6;
const PAYMENT_FETCH_RETRY_DELAY_MS = 1200;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }

  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function toNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = cleanText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
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

function toFeeRupees(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Number(numeric.toFixed(2));
}

function parseFeeRupeesInput(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Number(numeric.toFixed(2));
}

async function ensureInternshipFeeSettingsSchema(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${INTERNSHIP_FEE_SETTINGS_TABLE} (
      id TINYINT PRIMARY KEY,
      general_fee_rupees DECIMAL(10,2) NOT NULL DEFAULT 100.00,
      lateral_fee_rupees DECIMAL(10,2) NOT NULL DEFAULT 100.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await connection.query(
    `INSERT INTO ${INTERNSHIP_FEE_SETTINGS_TABLE} (id, general_fee_rupees, lateral_fee_rupees)
     VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [DEFAULT_GENERAL_INTERNSHIP_FEE_RUPEES, DEFAULT_LATERAL_INTERNSHIP_FEE_RUPEES]
  );
}

async function readInternshipFeeSettings(connection = db) {
  await ensureInternshipFeeSettingsSchema(connection);

  const [rows] = await connection.query(
    `SELECT general_fee_rupees, lateral_fee_rupees
     FROM ${INTERNSHIP_FEE_SETTINGS_TABLE}
     WHERE id = 1
     LIMIT 1`
  );

  const row = rows[0] || {};

  return {
    general_fee_rupees: toFeeRupees(
      row.general_fee_rupees,
      DEFAULT_GENERAL_INTERNSHIP_FEE_RUPEES
    ),
    lateral_fee_rupees: toFeeRupees(
      row.lateral_fee_rupees,
      DEFAULT_LATERAL_INTERNSHIP_FEE_RUPEES
    ),
  };
}

function getApplicableInternshipFeeRupees(settings, isLateral) {
  return isLateral ? settings.lateral_fee_rupees : settings.general_fee_rupees;
}

function isValidDateString(value) {
  if (!DATE_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
  );
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

async function hasExistingInternshipRegistration(email, connection = db) {
  const [rows] = await connection.query(
    `SELECT id
     FROM ${INTERNSHIP_TABLE}
     WHERE LOWER(email) = LOWER(?)
     LIMIT 1`,
    [email]
  );

  return Boolean(rows[0]);
}

function normalizeRegistrationPayload(input) {
  const payload = {
    internship_name: cleanText(input.internship_name) || 'Def-Space Summer Internship',
    internship_designation: cleanText(input.internship_designation) || 'Def-Space Tech Intern',
    full_name: cleanText(input.full_name),
    guardian_name: cleanText(input.guardian_name),
    gender: cleanText(input.gender),
    dob: cleanText(input.dob),
    mobile_number: cleanText(input.mobile_number || input.contact_number),
    email: normalizeEmail(input.email),
    alternative_email: normalizeEmail(input.alternative_email) || null,
    address: cleanText(input.address),
    city: cleanText(input.city),
    state: cleanText(input.state),
    pin_code: cleanText(input.pin_code),
    institution_name: cleanText(input.institution_name),
    educational_qualification: cleanText(input.educational_qualification),
    is_lateral: toBoolean(input.is_lateral ?? input.isLateral ?? input.islateral),
    declaration_accepted: toBoolean(input.declaration_accepted),
    passport_photo: Buffer.isBuffer(input.passport_photo) ? input.passport_photo : null,
    passport_photo_mime_type: toNullableText(input.passport_photo_mime_type),
    passport_photo_file_name: toNullableText(input.passport_photo_file_name),
  };

  const errors = [];

  if (!payload.full_name) {
    errors.push('full_name is required');
  }

  if (!payload.guardian_name) {
    errors.push('guardian_name is required');
  }

  if (!payload.gender) {
    errors.push('gender is required');
  }

  if (!payload.dob || !isValidDateString(payload.dob)) {
    errors.push('dob is required in YYYY-MM-DD format');
  }

  if (!payload.mobile_number) {
    errors.push('mobile_number is required');
  }

  if (!payload.email) {
    errors.push('email is required');
  } else if (!EMAIL_REGEX.test(payload.email)) {
    errors.push('Invalid email format');
  }

  if (payload.alternative_email && !EMAIL_REGEX.test(payload.alternative_email)) {
    errors.push('Invalid alternative_email format');
  }

  if (!payload.address) {
    errors.push('address is required');
  }

  if (!payload.city) {
    errors.push('city is required');
  }

  if (!payload.state) {
    errors.push('state is required');
  }

  if (!payload.pin_code) {
    errors.push('pin_code is required');
  }

  if (!payload.institution_name) {
    errors.push('institution_name is required');
  }

  if (!payload.educational_qualification) {
    errors.push('educational_qualification is required');
  }

  if (!payload.declaration_accepted) {
    errors.push('declaration_accepted must be true');
  }

  return { payload, errors };
}

async function createUserIfMissing(connection, email, fullName, mobileNumber) {
  const [existingUsers] = await connection.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (existingUsers[0]) {
    return;
  }

  const hashedPassword = await hashPassword(mobileNumber);

  try {
    await connection.query(
      'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
      [fullName, email, hashedPassword, roles.USER]
    );
  } catch (err) {
    if (err && err.code !== 'ER_DUP_ENTRY') {
      throw err;
    }
  }
}

async function createInternshipRegistrationRecord(connection, payload, paymentInfo) {
  await connection.query(
    `INSERT INTO ${INTERNSHIP_TABLE} (
      internship_name,
      internship_designation,
      full_name,
      guardian_name,
      gender,
      dob,
      mobile_number,
      email,
      alternative_email,
      address,
      city,
      state,
      pin_code,
      institution_name,
      educational_qualification,
      is_lateral,
      declaration_accepted,
      passport_photo,
      passport_photo_mime_type,
      passport_photo_file_name,
      payment_amount,
      payment_currency,
      razorpay_order_id,
      razorpay_payment_id,
      payment_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.internship_name,
      payload.internship_designation,
      payload.full_name,
      payload.guardian_name,
      payload.gender,
      payload.dob,
      payload.mobile_number,
      payload.email,
      payload.alternative_email,
      payload.address,
      payload.city,
      payload.state,
      payload.pin_code,
      payload.institution_name,
      payload.educational_qualification,
      payload.is_lateral,
      payload.declaration_accepted,
      payload.passport_photo,
      payload.passport_photo_mime_type,
      payload.passport_photo_file_name,
      paymentInfo.payment_amount,
      paymentInfo.payment_currency,
      paymentInfo.razorpay_order_id,
      paymentInfo.razorpay_payment_id,
      paymentInfo.payment_status,
    ]
  );
}

async function registerInternshipInternal(input, paymentInfo, options = {}) {
  const { requirePhoto = true } = options;
  const { payload, errors } = normalizeRegistrationPayload(input || {});

  if (requirePhoto && !payload.passport_photo) {
    errors.push('passport_photo is required');
  }

  if (errors.length > 0) {
    return {
      status: 400,
      body: {
        message: errors.join('. '),
      },
    };
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRegistrations] = await connection.query(
      `SELECT id FROM ${INTERNSHIP_TABLE} WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [payload.email]
    );

    if (existingRegistrations[0]) {
      await connection.rollback();
      return {
        status: 409,
        body: { message: 'You have already applied for this internship' },
      };
    }

    try {
      await createInternshipRegistrationRecord(connection, payload, paymentInfo);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        await connection.rollback();
        return {
          status: 409,
          body: { message: 'You have already applied for this internship' },
        };
      }

      throw err;
    }

    await createUserIfMissing(connection, payload.email, payload.full_name, payload.mobile_number);

    await connection.commit();

    return {
      status: 201,
      body: {
        message: 'Internship application submitted successfully',
      },
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function createPaymentOrder(input) {
  const applicantEmail = normalizeEmail(input?.email);
  const isLateral = toBoolean(input?.is_lateral ?? input?.isLateral ?? input?.islateral);

  if (!applicantEmail) {
    return {
      status: 400,
      body: { message: 'email is required' },
    };
  }

  if (!EMAIL_REGEX.test(applicantEmail)) {
    return {
      status: 400,
      body: { message: 'Invalid email format' },
    };
  }

  if (await hasExistingInternshipRegistration(applicantEmail)) {
    return {
      status: 200,
      body: {
        requires_payment: false,
        already_registered: true,
        amount: 0,
        currency: PAYMENT_CURRENCY,
        message: 'You have already applied for this internship',
      },
    };
  }

  const feeSettings = await readInternshipFeeSettings();
  const internshipFeeRupees = getApplicableInternshipFeeRupees(feeSettings, isLateral);
  const amountInPaise = toMoneyInPaise(internshipFeeRupees);

  if (amountInPaise === null) {
    return {
      status: 500,
      body: { message: 'Invalid internship fee settings value' },
    };
  }

  if (amountInPaise <= 0) {
    return {
      status: 200,
      body: {
        requires_payment: false,
        amount: 0,
        application_fee: internshipFeeRupees,
        currency: PAYMENT_CURRENCY,
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
    receipt: `summer_internship_${Date.now()}`,
    notes: {
      source: 'summer_internship_application',
      applicant_email: applicantEmail,
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
      application_fee: internshipFeeRupees,
      is_lateral: isLateral,
    },
  };
}

async function verifyPaymentAndRegister(input) {
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

  const isLateral = toBoolean(input?.is_lateral ?? input?.isLateral ?? input?.islateral);
  const feeSettings = await readInternshipFeeSettings();
  const internshipFeeRupees = getApplicableInternshipFeeRupees(feeSettings, isLateral);
  const amountInPaise = toMoneyInPaise(internshipFeeRupees);

  if (amountInPaise === null || amountInPaise <= 0) {
    return {
      status: 400,
      body: { message: 'Payment is not required for internship application' },
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

  if (String(payment.order_id) !== orderId) {
    return {
      status: 400,
      body: { message: 'Payment does not belong to this order' },
    };
  }

  if (Number(payment.amount) !== amountInPaise) {
    return {
      status: 400,
      body: { message: 'Paid amount does not match internship application fee' },
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

  const registrationResult = await registerInternshipInternal(
    input,
    {
      payment_amount: amountInPaise / 100,
      payment_currency: PAYMENT_CURRENCY,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      payment_status: cleanText(payment.status) || 'captured',
    },
    { requirePhoto: true }
  );

  if (registrationResult.status === 409) {
    return {
      status: 200,
      body: {
        message: 'Payment verified. You have already applied for this internship',
      },
    };
  }

  if (registrationResult.status !== 201) {
    return registrationResult;
  }

  return {
    status: 201,
    body: {
      message: 'Payment verified and internship application submitted successfully',
      payment: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        status: payment.status,
      },
    },
  };
}

async function registerWithoutPayment(input) {
  const isLateral = toBoolean(input?.is_lateral ?? input?.isLateral ?? input?.islateral);
  const feeSettings = await readInternshipFeeSettings();
  const internshipFeeRupees = getApplicableInternshipFeeRupees(feeSettings, isLateral);
  const amountInPaise = toMoneyInPaise(internshipFeeRupees);

  if (amountInPaise === null) {
    return {
      status: 500,
      body: { message: 'Invalid internship fee settings value' },
    };
  }

  if (amountInPaise > 0) {
    return {
      status: 400,
      body: { message: 'Payment is required before internship application submission' },
    };
  }

  return registerInternshipInternal(
    input,
    {
      payment_amount: 0,
      payment_currency: PAYMENT_CURRENCY,
      razorpay_order_id: null,
      razorpay_payment_id: null,
      payment_status: 'not_required',
    },
    { requirePhoto: true }
  );
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mapInternshipApplicationRow(row) {
  return {
    ...row,
    is_lateral: toBoolean(row.is_lateral),
    declaration_accepted: toBoolean(row.declaration_accepted),
    has_passport_photo: toBoolean(row.has_passport_photo),
    payment_amount: toNumberOrNull(row.payment_amount),
  };
}

async function getInternshipRegistrations() {
  const [rows] = await db.query(
    `SELECT
      id,
      internship_name,
      internship_designation,
      full_name,
      guardian_name,
      gender,
      DATE_FORMAT(dob, '%Y-%m-%d') AS dob,
      mobile_number,
      email,
      alternative_email,
      address,
      city,
      state,
      pin_code,
      institution_name,
      educational_qualification,
      is_lateral,
      declaration_accepted,
      CASE WHEN passport_photo IS NULL THEN 0 ELSE 1 END AS has_passport_photo,
      passport_photo_mime_type,
      passport_photo_file_name,
      payment_amount,
      payment_currency,
      razorpay_order_id,
      razorpay_payment_id,
      payment_status,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM ${INTERNSHIP_TABLE}
     ORDER BY created_at DESC, id DESC`
  );

  return {
    status: 200,
    body: {
      applications: rows.map(mapInternshipApplicationRow),
    },
  };
}

async function getInternshipFeeSettings() {
  const settings = await readInternshipFeeSettings();

  return {
    status: 200,
    body: settings,
  };
}

async function updateInternshipFeeSettings(input) {
  const generalFee = parseFeeRupeesInput(
    input?.general_fee_rupees ?? input?.generalFeeRupees ?? input?.general_fee
  );
  const lateralFee = parseFeeRupeesInput(
    input?.lateral_fee_rupees ?? input?.lateralFeeRupees ?? input?.lateral_fee
  );

  if (generalFee === null || lateralFee === null) {
    return {
      status: 400,
      body: {
        message: 'general_fee_rupees and lateral_fee_rupees are required and must be non-negative numbers',
      },
    };
  }

  await ensureInternshipFeeSettingsSchema();

  await db.query(
    `UPDATE ${INTERNSHIP_FEE_SETTINGS_TABLE}
     SET general_fee_rupees = ?, lateral_fee_rupees = ?
     WHERE id = 1`,
    [generalFee, lateralFee]
  );

  return {
    status: 200,
    body: {
      message: 'Internship fee settings updated successfully',
      general_fee_rupees: generalFee,
      lateral_fee_rupees: lateralFee,
    },
  };
}

module.exports = {
  createPaymentOrder,
  verifyPaymentAndRegister,
  registerWithoutPayment,
  getInternshipRegistrations,
  getInternshipFeeSettings,
  updateInternshipFeeSettings,
};
