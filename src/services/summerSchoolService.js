const crypto = require('crypto');
const Razorpay = require('razorpay');

const db = require('../config/db');
const StudentRegistration = require('../models/StudentRegistration');

const SUMMER_SCHOOL_SETTINGS_TABLE = 'summer_school_registration_settings';
const DEFAULT_INDIAN_FEE_AMOUNT = 1750;
const DEFAULT_OTHER_FEE_AMOUNT = 150;
const DEFAULT_BATCH_OPTIONS = Object.freeze([
  'Batch 1: 15th May - 30th June',
  'Batch 2: 19th June - 30th July',
]);
const SUMMER_SCHOOL_PAYMENT_CURRENCIES = Object.freeze({
  Indian: 'INR',
  Other: 'USD',
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

function toFeeAmount(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Number(numeric.toFixed(2));
}

function parseFeeAmountInput(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Number(numeric.toFixed(2));
}

function normalizeBatchOptions(rawOptions) {
  const source = Array.isArray(rawOptions) ? rawOptions : [];
  const normalized = source
    .map((option) => cleanText(option))
    .filter(Boolean);

  return [...new Set(normalized)];
}

function parseBatchOptionsInput(value) {
  if (Array.isArray(value)) {
    return normalizeBatchOptions(value);
  }

  if (typeof value === 'string') {
    const options = value
      .split(/\r?\n/)
      .map((option) => option.trim())
      .filter(Boolean);

    return normalizeBatchOptions(options);
  }

  return [];
}

async function ensureSummerSchoolSettingsSchema(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${SUMMER_SCHOOL_SETTINGS_TABLE} (
      id TINYINT PRIMARY KEY,
      indian_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 1750.00,
      other_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 150.00,
      batch_options_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await connection.query(
    `INSERT INTO ${SUMMER_SCHOOL_SETTINGS_TABLE} (id, indian_fee_amount, other_fee_amount, batch_options_json)
     VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [
      DEFAULT_INDIAN_FEE_AMOUNT,
      DEFAULT_OTHER_FEE_AMOUNT,
      JSON.stringify(DEFAULT_BATCH_OPTIONS),
    ]
  );
}

function parseStoredBatchOptions(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return [...DEFAULT_BATCH_OPTIONS];
  }

  try {
    const parsed = JSON.parse(rawValue);
    const normalized = normalizeBatchOptions(parsed);
    return normalized.length > 0 ? normalized : [...DEFAULT_BATCH_OPTIONS];
  } catch {
    return [...DEFAULT_BATCH_OPTIONS];
  }
}

async function readSummerSchoolSettings(connection = db) {
  await ensureSummerSchoolSettingsSchema(connection);

  const [rows] = await connection.query(
    `SELECT indian_fee_amount, other_fee_amount, batch_options_json
     FROM ${SUMMER_SCHOOL_SETTINGS_TABLE}
     WHERE id = 1
     LIMIT 1`
  );

  const row = rows[0] || {};

  return {
    indian_fee_amount: toFeeAmount(row.indian_fee_amount, DEFAULT_INDIAN_FEE_AMOUNT),
    other_fee_amount: toFeeAmount(row.other_fee_amount, DEFAULT_OTHER_FEE_AMOUNT),
    batch_options: parseStoredBatchOptions(row.batch_options_json),
  };
}

function resolveSummerSchoolPaymentConfig(nationality, settings) {
  const normalizedNationality = normalizeNationality(nationality);
  if (!normalizedNationality) {
    return null;
  }

  const amount =
    normalizedNationality === 'Indian'
      ? settings.indian_fee_amount
      : settings.other_fee_amount;
  const currency = SUMMER_SCHOOL_PAYMENT_CURRENCIES[normalizedNationality];

  return {
    nationality: normalizedNationality,
    amount,
    currency,
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
  const settings = await readSummerSchoolSettings();
  const paymentConfig = resolveSummerSchoolPaymentConfig(payload?.nationality, settings);

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

  const settings = await readSummerSchoolSettings();
  const paymentConfig = resolveSummerSchoolPaymentConfig(normalizedPayload.nationality, settings);
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

async function getSummerSchoolRegistrationSettings() {
  const settings = await readSummerSchoolSettings();

  return {
    status: 200,
    body: settings,
  };
}

async function updateSummerSchoolRegistrationSettings(payload) {
  const currentSettings = await readSummerSchoolSettings();

  const hasIndianFee = Object.prototype.hasOwnProperty.call(payload || {}, 'indian_fee_amount');
  const hasOtherFee = Object.prototype.hasOwnProperty.call(payload || {}, 'other_fee_amount');
  const hasBatchOptions = Object.prototype.hasOwnProperty.call(payload || {}, 'batch_options');

  const indianFeeAmount = hasIndianFee
    ? parseFeeAmountInput(payload.indian_fee_amount)
    : currentSettings.indian_fee_amount;
  const otherFeeAmount = hasOtherFee
    ? parseFeeAmountInput(payload.other_fee_amount)
    : currentSettings.other_fee_amount;
  const batchOptions = hasBatchOptions
    ? parseBatchOptionsInput(payload.batch_options)
    : currentSettings.batch_options;

  if (indianFeeAmount === null || otherFeeAmount === null) {
    return {
      status: 400,
      body: {
        message: 'indian_fee_amount and other_fee_amount must be non-negative numbers',
      },
    };
  }

  if (batchOptions.length === 0) {
    return {
      status: 400,
      body: {
        message: 'At least one batch option is required',
      },
    };
  }

  await ensureSummerSchoolSettingsSchema();

  await db.query(
    `UPDATE ${SUMMER_SCHOOL_SETTINGS_TABLE}
     SET indian_fee_amount = ?, other_fee_amount = ?, batch_options_json = ?
     WHERE id = 1`,
    [indianFeeAmount, otherFeeAmount, JSON.stringify(batchOptions)]
  );

  const updatedSettings = await readSummerSchoolSettings();

  return {
    status: 200,
    body: {
      ...updatedSettings,
      message: 'Summer school registration settings updated successfully',
    },
  };
}

module.exports = {
  registerStudent,
  createPaymentOrder,
  verifyPaymentAndRegister,
  listStudentRegistrations,
  getSummerSchoolRegistrationSettings,
  updateSummerSchoolRegistrationSettings,
};