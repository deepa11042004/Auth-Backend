const crypto = require('crypto');
const Razorpay = require('razorpay');

const db = require('../config/db');
const roles = require('../constants/roles');
const { hashPassword } = require('../utils/hashPassword');

const REGISTRATION_TABLE = 'workshop_registrations';
const WORKSHOP_TABLE = 'workshop_list';
const TOTAL_ENROLLMENTS_COLUMN = 'total_enrollments';
const DEFAULT_WORKSHOP_ID = 1;
const PAYMENT_CURRENCY = 'INR';
const SUCCESSFUL_PAYMENT_STATUSES = new Set(['captured', 'authorized']);
const COMPLETED_PAYMENT_STATUSES = new Set(['captured', 'authorized', 'not_required']);
const FAILED_PAYMENT_STATUSES = new Set(['failed', 'cancelled', 'canceled']);
const TRANSIENT_PAYMENT_STATUSES = new Set(['created', 'pending']);
const PAYMENT_FETCH_RETRY_ATTEMPTS = 6;
const PAYMENT_FETCH_RETRY_DELAY_MS = 1200;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DESIGNATIONS = new Set(['Student', 'Faculty', 'Professional', 'Others']);
const ALLOWED_NATIONALITIES = new Set(['Indian', 'Others']);
const COUNTRY_MAX_LENGTH = 120;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function toNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function normalizePaymentStatus(value) {
  const normalized = toNullableText(value)?.toLowerCase() || null;
  if (!normalized) {
    return null;
  }

  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'failed';
  }

  return normalized;
}

function isCompletedRegistrationStatus(value) {
  if (!value) {
    // Legacy rows may not have payment_status populated; treat them as completed.
    return true;
  }

  return COMPLETED_PAYMENT_STATUSES.has(value);
}

function isFailedPaymentStatus(value) {
  return Boolean(value) && FAILED_PAYMENT_STATUSES.has(value);
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
  if (normalized === 'other' || normalized === 'others') {
    return 'Others';
  }
  return '';
}

function normalizeNationality(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'indian') {
    return 'Indian';
  }
  if (normalized === 'other' || normalized === 'others') {
    return 'Others';
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

function toMoneyRupees(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric * 100) / 100;
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

async function resolvePaymentFromOrderContext(razorpayClient, orderId, paymentId) {
  const { payment, fetchError } = await fetchPaymentFromRazorpayWithRetry(
    razorpayClient,
    paymentId
  );

  if (payment && String(payment.order_id) === orderId) {
    return { payment, fetchError: null };
  }

  let lastError = fetchError;

  try {
    const orderPayments = await razorpayClient.orders.fetchPayments(orderId);
    const items = Array.isArray(orderPayments?.items) ? orderPayments.items : [];
    const matchingPayment = items.find(
      (item) => cleanText(item?.id) === paymentId
    );

    if (matchingPayment) {
      return { payment: matchingPayment, fetchError: null };
    }
  } catch (err) {
    lastError = err;
  }

  return { payment, fetchError: lastError };
}

async function resolveSuccessfulOrderPayment(razorpayClient, orderId) {
  try {
    const orderPayments = await razorpayClient.orders.fetchPayments(orderId);
    const items = Array.isArray(orderPayments?.items) ? orderPayments.items : [];

    const successfulPayment = items.find((item) =>
      SUCCESSFUL_PAYMENT_STATUSES.has(cleanText(item?.status).toLowerCase())
    );

    return successfulPayment || null;
  } catch {
    return null;
  }
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

async function hasExistingCompletedRegistration(workshopId, email, connection = db) {
  const [rows] = await connection.query(
    `SELECT id
     FROM ${REGISTRATION_TABLE}
     WHERE workshop_id = ?
       AND email = ?
       AND (
         payment_status IS NULL
         OR LOWER(payment_status) IN ('captured', 'authorized', 'not_required')
       )
     LIMIT 1`,
    [workshopId, email]
  );

  return Boolean(rows[0]);
}

async function incrementWorkshopEnrollmentCounter(connection, workshopId) {
  try {
    await connection.query(
      `UPDATE ${WORKSHOP_TABLE}
       SET ${TOTAL_ENROLLMENTS_COLUMN} = COALESCE(${TOTAL_ENROLLMENTS_COLUMN}, 0) + 1
       WHERE id = ?`,
      [workshopId]
    );
  } catch (err) {
    // Keep registration functional before the migration is applied.
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return;
    }

    throw err;
  }
}

async function createWorkshopUserIfMissing(connection, fullName, email, contactNumber) {
  const [existingUsers] = await connection.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (existingUsers[0]) {
    return;
  }

  const hashedPassword = await hashPassword(contactNumber);

  try {
    await connection.query(
      'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
      [fullName, email, hashedPassword, roles.USER]
    );
  } catch (err) {
    if (!err || err.code !== 'ER_DUP_ENTRY') {
      throw err;
    }
  }
}

async function reconcilePendingWorkshopRegistration(workshopId, email, connection = db) {
  if (!workshopId || !email) {
    return false;
  }

  const razorpayClient = getRazorpayClient();
  if (!razorpayClient) {
    return false;
  }

  const [attemptRows] = await connection.query(
    `SELECT
       id,
       full_name,
       contact_number,
       payment_status,
       razorpay_order_id,
       razorpay_payment_id
     FROM ${REGISTRATION_TABLE}
     WHERE workshop_id = ?
       AND email = ?
       AND (
         payment_status IS NULL
         OR LOWER(payment_status) NOT IN ('captured', 'authorized', 'not_required')
       )
       AND razorpay_order_id IS NOT NULL
       AND razorpay_order_id <> ''
     ORDER BY id DESC
     LIMIT 1`,
    [workshopId, email]
  );

  const attempt = attemptRows[0] || null;
  if (!attempt) {
    return false;
  }

  const orderId = cleanText(attempt.razorpay_order_id);
  const existingPaymentId = cleanText(attempt.razorpay_payment_id);

  if (!orderId) {
    return false;
  }

  let successfulPayment = null;

  if (existingPaymentId) {
    const resolved = await resolvePaymentFromOrderContext(
      razorpayClient,
      orderId,
      existingPaymentId
    );

    const resolvedStatus = cleanText(resolved.payment?.status).toLowerCase();
    if (
      resolved.payment
      && String(resolved.payment.order_id) === orderId
      && SUCCESSFUL_PAYMENT_STATUSES.has(resolvedStatus)
    ) {
      successfulPayment = resolved.payment;
    }
  }

  if (!successfulPayment) {
    const resolvedFromOrder = await resolveSuccessfulOrderPayment(
      razorpayClient,
      orderId
    );

    if (resolvedFromOrder && String(resolvedFromOrder.order_id) === orderId) {
      successfulPayment = resolvedFromOrder;
    }
  }

  if (!successfulPayment) {
    return false;
  }

  const successfulStatus = cleanText(successfulPayment.status).toLowerCase();
  if (!SUCCESSFUL_PAYMENT_STATUSES.has(successfulStatus)) {
    return false;
  }

  const paymentAmountInPaise = Number(successfulPayment.amount);
  const paymentAmount =
    Number.isFinite(paymentAmountInPaise) && paymentAmountInPaise >= 0
      ? paymentAmountInPaise / 100
      : null;
  const paymentCurrency = cleanText(successfulPayment.currency).toUpperCase() || PAYMENT_CURRENCY;
  const paymentId = cleanText(successfulPayment.id) || existingPaymentId || null;
  const paymentStatus = cleanText(successfulPayment.status) || 'captured';
  const paymentMode = cleanText(successfulPayment.method) || 'gateway_verified';

  await connection.query(
    `UPDATE ${REGISTRATION_TABLE}
     SET payment_amount = ?,
         payment_currency = ?,
         razorpay_order_id = ?,
         razorpay_payment_id = ?,
         payment_status = ?,
         payment_mode = ?
     WHERE id = ?
     LIMIT 1`,
    [
      paymentAmount,
      paymentCurrency,
      orderId,
      paymentId,
      paymentStatus,
      paymentMode,
      Number(attempt.id),
    ]
  );

  await incrementWorkshopEnrollmentCounter(connection, workshopId);
  await createWorkshopUserIfMissing(
    connection,
    cleanText(attempt.full_name),
    email,
    cleanText(attempt.contact_number)
  );

  return true;
}

async function ensureDesignationSupportsOthers(connection) {
  const [designationColumn] = await connection.query(
    `SHOW COLUMNS FROM ${REGISTRATION_TABLE} LIKE 'designation'`
  );

  const column = designationColumn[0] || null;
  const type = cleanText(column?.Type || column?.type).toLowerCase();

  if (!column || type.includes("'others'")) {
    return;
  }

  await connection.query(
    `ALTER TABLE ${REGISTRATION_TABLE}
     MODIFY COLUMN designation ENUM('Student','Faculty','Professional','Others') NOT NULL`
  );
}

async function ensureCountryColumn(connection) {
  const [countryColumn] = await connection.query(
    `SHOW COLUMNS FROM ${REGISTRATION_TABLE} LIKE 'country'`
  );

  if (countryColumn.length > 0) {
    return;
  }

  try {
    await connection.query(
      `ALTER TABLE ${REGISTRATION_TABLE} ADD COLUMN country VARCHAR(${COUNTRY_MAX_LENGTH}) NULL`
    );
  } catch (err) {
    if (!err) {
      throw err;
    }

    // If another process added the column first, continue safely.
    if (err.code === 'ER_DUP_FIELDNAME') {
      return;
    }

    throw err;
  }
}

async function insertWorkshopRegistrationRecord(connection, payload) {
  const baseColumns = [
    'workshop_id',
    'full_name',
    'email',
    'contact_number',
    'alternative_email',
    'institution',
    'designation',
    'nationality',
    'country',
    'agree_recording',
    'agree_terms',
  ];

  const paymentColumns = [
    'payment_amount',
    'payment_currency',
    'razorpay_order_id',
    'razorpay_payment_id',
    'payment_status',
    'payment_mode',
  ];

  const legacyColumns = [
    'workshop_id',
    'full_name',
    'email',
    'contact_number',
    'alternative_email',
    'institution',
    'designation',
    'agree_recording',
    'agree_terms',
  ];

  const columnValueMap = {
    workshop_id: payload.workshopId,
    full_name: payload.fullName,
    email: payload.email,
    contact_number: payload.contactNumber,
    alternative_email: payload.alternativeEmail,
    institution: payload.institution,
    designation: payload.designation,
    nationality: payload.nationality,
    country: payload.country,
    agree_recording: payload.agreeRecording,
    agree_terms: payload.agreeTerms,
    payment_amount: payload.paymentAmount,
    payment_currency: payload.paymentCurrency,
    razorpay_order_id: payload.razorpayOrderId,
    razorpay_payment_id: payload.razorpayPaymentId,
    payment_status: payload.paymentStatus,
    payment_mode: payload.paymentMode,
  };

  const columnsWithPayment = [...baseColumns, ...paymentColumns];
  const baseColumnsWithoutCountry = baseColumns.filter((column) => column !== 'country');

  const insertAttempts = [
    columnsWithPayment,
    baseColumns,
    [...baseColumnsWithoutCountry, ...paymentColumns],
    baseColumnsWithoutCountry,
    legacyColumns,
  ];

  for (const columns of insertAttempts) {
    try {
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map((column) => columnValueMap[column]);

      await connection.query(
        `INSERT INTO ${REGISTRATION_TABLE} (${columns.join(', ')})
         VALUES (${placeholders})`,
        values
      );

      return;
    } catch (err) {
      // Keep registration functional before schema migrations are applied.
      if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
        throw err;
      }
    }
  }

  throw new Error('Unable to insert workshop registration record');
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

  if (payerEmail && (await hasExistingCompletedRegistration(workshopId, payerEmail))) {
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

  if (payerEmail) {
    try {
      await reconcilePendingWorkshopRegistration(workshopId, payerEmail);
    } catch {
      // Best effort only: continue normal order creation when reconciliation fails.
    }

    if (await hasExistingCompletedRegistration(workshopId, payerEmail)) {
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
      ...(payerEmail ? { applicant_email: payerEmail } : {}),
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

  let order = null;

  try {
    order = await razorpayClient.orders.fetch(orderId);
  } catch (err) {
    const reason = err instanceof Error ? cleanText(err.message) : '';
    return {
      status: 400,
      body: {
        message: 'Unable to validate order with Razorpay',
        ...(reason ? { reason } : {}),
      },
    };
  }

  const orderAmountInPaise = Number(order?.amount);
  if (!Number.isFinite(orderAmountInPaise) || orderAmountInPaise <= 0) {
    return {
      status: 400,
      body: { message: 'Invalid order amount received from Razorpay' },
    };
  }

  const orderCurrency = cleanText(order?.currency).toUpperCase() || PAYMENT_CURRENCY;
  if (orderCurrency !== PAYMENT_CURRENCY) {
    return {
      status: 400,
      body: {
        message: `Order currency mismatch. Expected ${PAYMENT_CURRENCY}, received ${orderCurrency || 'unknown'}`,
      },
    };
  }

  const orderWorkshopId = toPositiveInt(order?.notes?.workshop_id);
  if (orderWorkshopId && orderWorkshopId !== workshopId) {
    return {
      status: 400,
      body: { message: 'Order does not belong to the selected workshop' },
    };
  }

  const orderApplicantEmail = normalizeEmail(order?.notes?.applicant_email);
  const providedEmail = normalizeEmail(input?.email);
  if (orderApplicantEmail && providedEmail && orderApplicantEmail !== providedEmail) {
    return {
      status: 400,
      body: { message: 'Order does not belong to the provided email address' },
    };
  }

  const { payment, fetchError } = await resolvePaymentFromOrderContext(
    razorpayClient,
    orderId,
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

  if (Number(payment.amount) !== orderAmountInPaise) {
    return {
      status: 400,
      body: { message: 'Paid amount does not match workshop order amount' },
    };
  }

  const paymentCurrency = cleanText(payment.currency).toUpperCase() || orderCurrency;
  if (paymentCurrency !== orderCurrency) {
    return {
      status: 400,
      body: {
        message: `Payment currency mismatch. Expected ${orderCurrency}, received ${paymentCurrency || 'unknown'}`,
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

  const registrationResult = await registerForWorkshop({
    ...input,
    workshop_id: workshopId,
    payment_amount: orderAmountInPaise / 100,
    payment_currency: paymentCurrency,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    payment_status: cleanText(payment.status) || 'captured',
    payment_mode: cleanText(payment.method),
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
            amount: orderAmountInPaise / 100,
            currency: paymentCurrency,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            status: payment.status,
            mode: cleanText(payment.method) || null,
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
        amount: orderAmountInPaise / 100,
        currency: paymentCurrency,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        status: payment.status,
        mode: cleanText(payment.method) || null,
      },
    },
  };
}

async function registerForWorkshop(input) {
  const fullName = cleanText(input.full_name);
  const email = normalizeEmail(input.email);
  const contactNumber = cleanText(input.contact_number);
  const alternativeEmail = normalizeEmail(input.alternative_email);
  const institution = cleanText(input.institution);
  const designation = normalizeDesignation(input.designation);
  const nationality = normalizeNationality(input.nationality);
  const country = toNullableText(input.country);
  const agreeRecording = toBoolean(input.agree_recording);
  const agreeTerms = toBoolean(input.agree_terms);
  const workshopId = resolveWorkshopId(input || {});
  const paymentAmount = toMoneyRupees(input.payment_amount);
  const paymentCurrency = toNullableText(input.payment_currency)?.toUpperCase() || null;
  const razorpayOrderId = toNullableText(input.razorpay_order_id);
  const razorpayPaymentId = toNullableText(input.razorpay_payment_id);
  const paymentStatus = normalizePaymentStatus(input.payment_status);
  const paymentMode = toNullableText(input.payment_mode);

  if (!workshopId) {
    return {
      status: 400,
      body: { message: 'workshop_id is required and must be a positive integer' },
    };
  }

  if (
    !fullName
    || !email
    || !contactNumber
    || !alternativeEmail
    || !institution
    || !designation
    || !nationality
  ) {
    return {
      status: 400,
      body: {
        message:
          'full_name, email, contact_number, alternative_email, institution, designation and nationality are required',
      },
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      status: 400,
      body: { message: 'Invalid email format' },
    };
  }

  if (!EMAIL_REGEX.test(alternativeEmail)) {
    return {
      status: 400,
      body: { message: 'Invalid alternative_email format' },
    };
  }

  if (!ALLOWED_DESIGNATIONS.has(designation)) {
    return {
      status: 400,
      body: { message: 'designation must be Student, Faculty, Professional, or Others' },
    };
  }

  if (!ALLOWED_NATIONALITIES.has(nationality)) {
    return {
      status: 400,
      body: { message: 'nationality must be Indian or Others' },
    };
  }

  const resolvedCountry = nationality === 'Others' ? country : null;

  if (nationality === 'Others' && !resolvedCountry) {
    return {
      status: 400,
      body: { message: 'country is required when nationality is Others' },
    };
  }

  if (resolvedCountry && resolvedCountry.length > COUNTRY_MAX_LENGTH) {
    return {
      status: 400,
      body: { message: `country must be at most ${COUNTRY_MAX_LENGTH} characters` },
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
    await ensureCountryColumn(connection);
    await ensureDesignationSupportsOthers(connection);

    await connection.beginTransaction();

    const [workshopRows] = await connection.query(
      `SELECT id, fee FROM ${WORKSHOP_TABLE} WHERE id = ? LIMIT 1`,
      [workshopId]
    );

    if (!workshopRows[0]) {
      await connection.rollback();
      return {
        status: 404,
        body: { message: 'Workshop not found' },
      };
    }

    const workshopFeeRupees = toMoneyRupees(workshopRows[0].fee);
    const hasPaymentIdentifiers = Boolean(razorpayOrderId || razorpayPaymentId);
    const isPaidWorkshop = workshopFeeRupees !== null && workshopFeeRupees > 0;
    const isFailedAttempt = isFailedPaymentStatus(paymentStatus);
    let effectiveFailedAttempt = isFailedAttempt;
    let reconciledSuccessfulPayment = null;

    if (isPaidWorkshop && isFailedAttempt && razorpayOrderId) {
      const razorpayClient = getRazorpayClient();

      if (razorpayClient) {
        let orderBelongsToRegistration = true;

        try {
          const order = await razorpayClient.orders.fetch(razorpayOrderId);
          const orderWorkshopId = toPositiveInt(order?.notes?.workshop_id);
          const orderApplicantEmail = normalizeEmail(order?.notes?.applicant_email);

          if (orderWorkshopId && orderWorkshopId !== workshopId) {
            orderBelongsToRegistration = false;
          }

          if (orderApplicantEmail && orderApplicantEmail !== email) {
            orderBelongsToRegistration = false;
          }
        } catch {
          // Continue with fallback behavior when Razorpay lookup fails.
        }

        if (orderBelongsToRegistration) {
          if (razorpayPaymentId) {
            try {
              const resolved = await resolvePaymentFromOrderContext(
                razorpayClient,
                razorpayOrderId,
                razorpayPaymentId
              );

              const resolvedStatus = cleanText(resolved.payment?.status).toLowerCase();
              if (
                resolved.payment
                && String(resolved.payment.order_id) === razorpayOrderId
                && SUCCESSFUL_PAYMENT_STATUSES.has(resolvedStatus)
              ) {
                reconciledSuccessfulPayment = resolved.payment;
              }
            } catch {
              // Ignore reconciliation failures and preserve failed-attempt fallback behavior.
            }
          }

          if (!reconciledSuccessfulPayment) {
            const resolvedFromOrder = await resolveSuccessfulOrderPayment(
              razorpayClient,
              razorpayOrderId
            );

            if (
              resolvedFromOrder
              && String(resolvedFromOrder.order_id) === razorpayOrderId
            ) {
              reconciledSuccessfulPayment = resolvedFromOrder;
            }
          }
        }
      }
    }

    if (reconciledSuccessfulPayment) {
      effectiveFailedAttempt = false;
    }

    const reconciledAmountInPaise = Number(reconciledSuccessfulPayment?.amount);
    const reconciledCurrency = cleanText(reconciledSuccessfulPayment?.currency).toUpperCase();
    const reconciledPaymentId = cleanText(reconciledSuccessfulPayment?.id);
    const reconciledStatus = cleanText(reconciledSuccessfulPayment?.status).toLowerCase();
    const reconciledMode = cleanText(reconciledSuccessfulPayment?.method);

    if (isPaidWorkshop && !paymentStatus && !hasPaymentIdentifiers) {
      await connection.rollback();
      return {
        status: 400,
        body: { message: 'Payment is required before workshop registration submission' },
      };
    }

    if (isPaidWorkshop && paymentStatus === 'not_required') {
      await connection.rollback();
      return {
        status: 400,
        body: { message: 'payment_status not_required is invalid for paid workshop registration' },
      };
    }

    const resolvedPaymentAmount =
      reconciledSuccessfulPayment
        ? (
          Number.isFinite(reconciledAmountInPaise) && reconciledAmountInPaise >= 0
            ? reconciledAmountInPaise / 100
            : workshopFeeRupees
        )
        : (paymentAmount !== null
          ? paymentAmount
          : workshopFeeRupees);
    const resolvedPaymentCurrency =
      reconciledSuccessfulPayment
        ? (reconciledCurrency || PAYMENT_CURRENCY)
        : (paymentCurrency || (resolvedPaymentAmount !== null ? PAYMENT_CURRENCY : null));
    const resolvedRazorpayPaymentId =
      reconciledSuccessfulPayment
        ? (reconciledPaymentId || razorpayPaymentId)
        : razorpayPaymentId;
    const resolvedPaymentStatus =
      reconciledSuccessfulPayment
        ? (reconciledStatus || 'captured')
        : (paymentStatus
          || (resolvedPaymentAmount === 0
            ? 'not_required'
            : (hasPaymentIdentifiers ? 'captured' : 'pending')));
    const resolvedPaymentMode =
      reconciledSuccessfulPayment
        ? (reconciledMode || paymentMode || 'gateway_verified')
        : (paymentMode || (resolvedPaymentAmount === 0 ? 'free' : (effectiveFailedAttempt ? 'failed' : null)));
    const shouldFinalizeRegistration = isCompletedRegistrationStatus(resolvedPaymentStatus);
    let reusedFailedAttempt = false;

    try {
      await insertWorkshopRegistrationRecord(connection, {
        workshopId,
        fullName,
        email,
        contactNumber,
        alternativeEmail,
        institution,
        designation,
        nationality,
        country: resolvedCountry,
        agreeRecording,
        agreeTerms,
        paymentAmount: resolvedPaymentAmount,
        paymentCurrency: resolvedPaymentCurrency,
        razorpayOrderId,
        razorpayPaymentId: resolvedRazorpayPaymentId,
        paymentStatus: resolvedPaymentStatus,
        paymentMode: resolvedPaymentMode,
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        const [existingRows] = await connection.query(
          `SELECT id, payment_status
           FROM ${REGISTRATION_TABLE}
           WHERE workshop_id = ? AND email = ?
           ORDER BY id DESC
           LIMIT 1`,
          [workshopId, email]
        );

        const existingRow = existingRows[0] || null;
        const existingStatus = normalizePaymentStatus(existingRow?.payment_status);

        if (existingRow && !isCompletedRegistrationStatus(existingStatus)) {
          await connection.query(
            `UPDATE ${REGISTRATION_TABLE}
             SET payment_amount = ?,
                 payment_currency = ?,
                 razorpay_order_id = ?,
                 razorpay_payment_id = ?,
                 payment_status = ?,
                 payment_mode = ?
             WHERE id = ?
             LIMIT 1`,
            [
              resolvedPaymentAmount,
              resolvedPaymentCurrency,
              razorpayOrderId,
              resolvedRazorpayPaymentId,
              resolvedPaymentStatus,
              resolvedPaymentMode,
              Number(existingRow.id),
            ]
          );

          reusedFailedAttempt = true;
        } else {
          await connection.rollback();
          return {
            status: 409,
            body: { message: 'You have already registered for this workshop' },
          };
        }
      } else {
        throw err;
      }
    }

    if (shouldFinalizeRegistration) {
      await incrementWorkshopEnrollmentCounter(connection, workshopId);
      await createWorkshopUserIfMissing(connection, fullName, email, contactNumber);
    }

    await connection.commit();

    const attemptPaymentStatus = resolvedPaymentStatus || 'failed';

    return {
      status: 201,
      body: {
        message: shouldFinalizeRegistration
          ? (reusedFailedAttempt
            ? 'Workshop registration completed successfully'
            : 'Workshop registration successful')
          : `Workshop registration attempt saved with payment status: ${attemptPaymentStatus}`,
        registration: {
          workshop_id: workshopId,
          email,
          payment: {
            amount: resolvedPaymentAmount,
            currency: resolvedPaymentCurrency,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: resolvedRazorpayPaymentId,
            status: resolvedPaymentStatus,
            mode: resolvedPaymentMode,
          },
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
