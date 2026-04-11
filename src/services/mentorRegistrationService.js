const crypto = require('crypto');
const Razorpay = require('razorpay');

const db = require('../config/db');

const MENTOR_REGISTRATION_TABLE = 'mentor_registrations';
const FILE_COLUMNS = new Set(['resume', 'profile_photo']);
const MENTOR_STATUS_PENDING = 'pending';
const MENTOR_STATUS_ACTIVE = 'active';
const VALID_MENTOR_STATUSES = new Set([MENTOR_STATUS_PENDING, MENTOR_STATUS_ACTIVE]);
const ALLOWED_MENTOR_NATIONALITIES = new Set(['Indian', 'Others']);
const MENTOR_REGISTRATION_FEES = Object.freeze({
  Indian: {
    amount: 1000,
    currency: 'INR',
  },
  Others: {
    amount: 150,
    currency: 'USD',
  },
});
const SUCCESSFUL_PAYMENT_STATUSES = new Set(['captured', 'authorized']);
const TRANSIENT_PAYMENT_STATUSES = new Set(['created', 'pending']);
const PAYMENT_FETCH_RETRY_ATTEMPTS = 6;
const PAYMENT_FETCH_RETRY_DELAY_MS = 1200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPTIONAL_MENTOR_COLUMNS = [
  'nationality',
  'currency',
  'honorarium_hourly',
  'honorarium_daily',
  'honorarium_weekly',
  'honorarium_project',
  'payment_amount',
  'payment_currency',
  'razorpay_order_id',
  'razorpay_payment_id',
  'payment_status',
  'payment_mode',
];

let mentorTableColumnsPromise = null;

const BASE_MENTOR_DETAIL_COLUMNS = [
  'id',
  'full_name',
  'email',
  'phone',
  'dob',
  'current_position',
  'organization',
  'years_experience',
  'professional_bio',
  'primary_track',
  'secondary_skills',
  'key_competencies',
  'video_call',
  'phone_call',
  'live_chat',
  'email_support',
  'availability',
  'max_students',
  'session_duration',
  'consultation_fee',
  'price_5_sessions',
  'price_10_sessions',
  'price_extended',
  'complimentary_session',
  'linkedin_url',
  'portfolio_url',
  'has_mentored_before',
  'mentoring_experience',
  'accepted_guidelines',
  'accepted_code_of_conduct',
];

const DERIVED_MENTOR_DETAIL_COLUMNS = [
  '(resume IS NOT NULL) AS has_resume',
  '(profile_photo IS NOT NULL) AS has_profile_photo',
  'created_at',
];

function cleanText(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }

  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function normalizeMentorNationality(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'indian') {
    return 'Indian';
  }

  if (normalized === 'other' || normalized === 'others') {
    return 'Others';
  }

  return '';
}

function resolveMentorPaymentConfig(nationality) {
  const normalizedNationality = normalizeMentorNationality(nationality);

  if (!ALLOWED_MENTOR_NATIONALITIES.has(normalizedNationality)) {
    return null;
  }

  return {
    nationality: normalizedNationality,
    amount: MENTOR_REGISTRATION_FEES[normalizedNationality].amount,
    currency: MENTOR_REGISTRATION_FEES[normalizedNationality].currency,
  };
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

function toBoolean(value) {
  return value === true || value === 1;
}

function mapMentorDetails(row) {
  return {
    id: Number(row.id),
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    dob: row.dob,
    nationality: typeof row.nationality === 'string' && row.nationality.trim()
      ? row.nationality
      : null,
    current_position: row.current_position,
    organization: row.organization,
    years_experience: row.years_experience,
    professional_bio: row.professional_bio,
    primary_track: row.primary_track,
    secondary_skills: row.secondary_skills,
    key_competencies: row.key_competencies,
    video_call: toBoolean(row.video_call),
    phone_call: toBoolean(row.phone_call),
    live_chat: toBoolean(row.live_chat),
    email_support: toBoolean(row.email_support),
    availability: row.availability,
    max_students: row.max_students,
    session_duration: row.session_duration,
    currency: typeof row.currency === 'string' && row.currency.trim()
      ? row.currency
      : null,
    honorarium_hourly:
      row.honorarium_hourly === null || row.honorarium_hourly === undefined
        ? null
        : Number(row.honorarium_hourly),
    honorarium_daily:
      row.honorarium_daily === null || row.honorarium_daily === undefined
        ? null
        : Number(row.honorarium_daily),
    honorarium_weekly:
      row.honorarium_weekly === null || row.honorarium_weekly === undefined
        ? null
        : Number(row.honorarium_weekly),
    honorarium_project:
      row.honorarium_project === null || row.honorarium_project === undefined
        ? null
        : Number(row.honorarium_project),
    payment_amount:
      row.payment_amount === null || row.payment_amount === undefined
        ? null
        : Number(row.payment_amount),
    payment_currency:
      typeof row.payment_currency === 'string' && row.payment_currency.trim()
        ? row.payment_currency
        : null,
    razorpay_order_id:
      typeof row.razorpay_order_id === 'string' && row.razorpay_order_id.trim()
        ? row.razorpay_order_id
        : null,
    razorpay_payment_id:
      typeof row.razorpay_payment_id === 'string' && row.razorpay_payment_id.trim()
        ? row.razorpay_payment_id
        : null,
    payment_status:
      typeof row.payment_status === 'string' && row.payment_status.trim()
        ? row.payment_status
        : null,
    payment_mode:
      typeof row.payment_mode === 'string' && row.payment_mode.trim()
        ? row.payment_mode
        : null,
    consultation_fee: row.consultation_fee === null ? null : Number(row.consultation_fee),
    price_5_sessions: row.price_5_sessions === null ? null : Number(row.price_5_sessions),
    price_10_sessions: row.price_10_sessions === null ? null : Number(row.price_10_sessions),
    price_extended: row.price_extended === null ? null : Number(row.price_extended),
    complimentary_session: toBoolean(row.complimentary_session),
    linkedin_url: row.linkedin_url,
    portfolio_url: row.portfolio_url,
    has_mentored_before: row.has_mentored_before === null ? null : toBoolean(row.has_mentored_before),
    mentoring_experience: row.mentoring_experience,
    accepted_guidelines: row.accepted_guidelines === null ? null : toBoolean(row.accepted_guidelines),
    accepted_code_of_conduct: row.accepted_code_of_conduct === null
      ? null
      : toBoolean(row.accepted_code_of_conduct),
    status:
      typeof row.status === 'string' && row.status.trim()
        ? row.status
        : MENTOR_STATUS_PENDING,
    has_resume: toBoolean(row.has_resume),
    has_profile_photo: toBoolean(row.has_profile_photo),
    created_at: row.created_at,
  };
}

async function getMentorTableColumns() {
  if (!mentorTableColumnsPromise) {
    mentorTableColumnsPromise = db
      .query(`SHOW COLUMNS FROM ${MENTOR_REGISTRATION_TABLE}`)
      .then(([rows]) => new Set(rows.map((row) => String(row.Field))))
      .catch(() => null);
  }

  return mentorTableColumnsPromise;
}

async function getMentorDetailColumns() {
  const mentorTableColumns = await getMentorTableColumns();
  const detailColumns = [...BASE_MENTOR_DETAIL_COLUMNS];
  const insertIndex = detailColumns.indexOf('consultation_fee');

  const availableOptionalColumns = mentorTableColumns
    ? OPTIONAL_MENTOR_COLUMNS.filter((column) => mentorTableColumns.has(column))
    : [];

  const remainingOptionalColumns = availableOptionalColumns.filter(
    (column) => column !== 'nationality'
  );

  if (availableOptionalColumns.includes('nationality')) {
    const dobIndex = detailColumns.indexOf('dob');
    if (dobIndex >= 0) {
      detailColumns.splice(dobIndex + 1, 0, 'nationality');
    }
  }

  if (insertIndex >= 0 && remainingOptionalColumns.length > 0) {
    detailColumns.splice(insertIndex, 0, ...remainingOptionalColumns);
  }

  return [...detailColumns, ...DERIVED_MENTOR_DETAIL_COLUMNS].join(',\n  ');
}

async function isMentorEmailTaken(email) {
  const [rows] = await db.query(
    `SELECT id
     FROM ${MENTOR_REGISTRATION_TABLE}
     WHERE LOWER(email) = LOWER(?)
     LIMIT 1`,
    [email]
  );

  return rows.length > 0;
}

async function createPaymentOrder(input) {
  const applicantEmail = normalizeEmail(input?.email);
  const paymentConfig = resolveMentorPaymentConfig(input?.nationality);

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

  if (!paymentConfig) {
    return {
      status: 400,
      body: { message: 'nationality must be Indian or Others' },
    };
  }

  if (await isMentorEmailTaken(applicantEmail)) {
    return {
      status: 200,
      body: {
        requires_payment: false,
        already_registered: true,
        amount: 0,
        currency: paymentConfig.currency,
        message: 'Email already registered.',
      },
    };
  }

  const amountInMinorUnits = toMoneyInMinorUnits(paymentConfig.amount);
  if (amountInMinorUnits === null) {
    return {
      status: 500,
      body: { message: 'Invalid mentor registration fee configuration' },
    };
  }

  if (amountInMinorUnits <= 0) {
    return {
      status: 200,
      body: {
        requires_payment: false,
        amount: 0,
        currency: paymentConfig.currency,
        registration_fee: paymentConfig.amount,
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
    amount: amountInMinorUnits,
    currency: paymentConfig.currency,
    receipt: `mentor_registration_${Date.now()}`,
    notes: {
      source: 'mentor_registration',
      applicant_email: applicantEmail,
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

async function verifyPaymentForRegistration(input) {
  const orderId = cleanText(input?.razorpay_order_id);
  const paymentId = cleanText(input?.razorpay_payment_id);
  const signature = cleanText(input?.razorpay_signature);

  if (!orderId || !paymentId || !signature) {
    return {
      status: 400,
      body: {
        message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
      },
      paymentDetails: null,
    };
  }

  const paymentConfig = resolveMentorPaymentConfig(input?.nationality);
  if (!paymentConfig) {
    return {
      status: 400,
      body: { message: 'nationality must be Indian or Others' },
      paymentDetails: null,
    };
  }

  const amountInMinorUnits = toMoneyInMinorUnits(paymentConfig.amount);
  if (amountInMinorUnits === null || amountInMinorUnits <= 0) {
    return {
      status: 400,
      body: { message: 'Payment is not required for mentor registration' },
      paymentDetails: null,
    };
  }

  const { keySecret } = getRazorpayCredentials();
  const razorpayClient = getRazorpayClient();

  if (!keySecret || !razorpayClient) {
    return {
      status: 500,
      body: { message: 'Razorpay credentials are missing on the server' },
      paymentDetails: null,
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
      paymentDetails: null,
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
      paymentDetails: null,
    };
  }

  if (String(payment.order_id) !== orderId) {
    return {
      status: 400,
      body: { message: 'Payment does not belong to this order' },
      paymentDetails: null,
    };
  }

  if (Number(payment.amount) !== amountInMinorUnits) {
    return {
      status: 400,
      body: { message: 'Paid amount does not match mentor registration fee' },
      paymentDetails: null,
    };
  }

  const paymentCurrency = cleanText(payment.currency).toUpperCase();
  if (paymentCurrency !== paymentConfig.currency) {
    return {
      status: 400,
      body: {
        message: `Payment currency mismatch. Expected ${paymentConfig.currency}, received ${paymentCurrency || 'unknown'}`,
      },
      paymentDetails: null,
    };
  }

  const paymentStatus = cleanText(payment.status).toLowerCase();
  if (!SUCCESSFUL_PAYMENT_STATUSES.has(paymentStatus)) {
    return {
      status: 400,
      body: {
        message: `Payment is not successful yet (status: ${paymentStatus || 'unknown'})`,
      },
      paymentDetails: null,
    };
  }

  return {
    status: 200,
    body: {
      message: 'Payment verified successfully',
    },
    paymentDetails: {
      payment_amount: amountInMinorUnits / 100,
      payment_currency: paymentConfig.currency,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      payment_status: cleanText(payment.status) || 'captured',
      payment_mode: cleanText(payment.method) || null,
    },
  };
}

async function createMentorRegistration(payload) {
  const legacyColumns = [
    'full_name',
    'email',
    'phone',
    'dob',
    'current_position',
    'organization',
    'years_experience',
    'professional_bio',
    'primary_track',
    'secondary_skills',
    'key_competencies',
    'video_call',
    'phone_call',
    'live_chat',
    'email_support',
    'availability',
    'max_students',
    'session_duration',
    'consultation_fee',
    'price_5_sessions',
    'price_10_sessions',
    'price_extended',
    'complimentary_session',
    'resume',
    'profile_photo',
    'linkedin_url',
    'portfolio_url',
    'has_mentored_before',
    'mentoring_experience',
    'accepted_guidelines',
    'accepted_code_of_conduct',
  ];

  const mentorTableColumns = await getMentorTableColumns();
  const baseColumns = mentorTableColumns
    ? [...legacyColumns, ...OPTIONAL_MENTOR_COLUMNS].filter((column) => mentorTableColumns.has(column))
    : legacyColumns;

  const baseValues = baseColumns.map((column) => payload[column] ?? null);

  const shouldIncludeStatus = !mentorTableColumns || mentorTableColumns.has('status');
  const columnsWithStatus = shouldIncludeStatus
    ? [...baseColumns, 'status']
    : baseColumns;
  const valuesWithStatus = shouldIncludeStatus
    ? [...baseValues, MENTOR_STATUS_PENDING]
    : baseValues;

  const placeholdersWithStatus = columnsWithStatus.map(() => '?').join(', ');

  let result;

  try {
    [result] = await db.query(
      `INSERT INTO ${MENTOR_REGISTRATION_TABLE} (${columnsWithStatus.join(', ')})
       VALUES (${placeholdersWithStatus})`,
      valuesWithStatus
    );
  } catch (err) {
    // Keep registration backward compatible before status-column migration.
    if (!shouldIncludeStatus || !err || err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    const placeholders = baseColumns.map(() => '?').join(', ');

    [result] = await db.query(
      `INSERT INTO ${MENTOR_REGISTRATION_TABLE} (${baseColumns.join(', ')})
       VALUES (${placeholders})`,
      baseValues
    );
  }

  return Number(result.insertId);
}

async function getMentorById(id) {
  let rows;
  const detailColumns = await getMentorDetailColumns();

  try {
    [rows] = await db.query(
      `SELECT
        ${detailColumns},
        status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
  } catch (err) {
    if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    [rows] = await db.query(
      `SELECT
        ${detailColumns}
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    rows = rows.map((row) => ({
      ...row,
      status: MENTOR_STATUS_PENDING,
    }));
  }

  if (rows.length === 0) {
    return null;
  }

  return mapMentorDetails(rows[0]);
}

async function getMentorsByStatus(status) {
  if (!VALID_MENTOR_STATUSES.has(status)) {
    return [];
  }

  let rows;
  const detailColumns = await getMentorDetailColumns();

  try {
    [rows] = await db.query(
      `SELECT
        ${detailColumns},
        status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE status = ?
       ORDER BY created_at DESC, id DESC`,
      [status]
    );
  } catch (err) {
    if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    // Graceful fallback for pre-migration environments.
    if (status === MENTOR_STATUS_ACTIVE) {
      return [];
    }

    [rows] = await db.query(
      `SELECT
        ${detailColumns}
       FROM ${MENTOR_REGISTRATION_TABLE}
       ORDER BY created_at DESC, id DESC`
    );

    rows = rows.map((row) => ({
      ...row,
      status: MENTOR_STATUS_PENDING,
    }));
  }

  return rows.map(mapMentorDetails);
}

async function getPendingMentors() {
  return getMentorsByStatus(MENTOR_STATUS_PENDING);
}

async function getActiveMentors() {
  return getMentorsByStatus(MENTOR_STATUS_ACTIVE);
}

async function approveMentorById(id) {
  try {
    const [rows] = await db.query(
      `SELECT id, status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return { outcome: 'not_found' };
    }

    const currentStatus = String(rows[0].status || '').trim().toLowerCase();

    if (currentStatus === MENTOR_STATUS_ACTIVE) {
      const mentor = await getMentorById(id);
      return { outcome: 'already_active', mentor };
    }

    if (currentStatus && currentStatus !== MENTOR_STATUS_PENDING) {
      return { outcome: 'invalid_status', status: currentStatus };
    }

    await db.query(
      `UPDATE ${MENTOR_REGISTRATION_TABLE}
       SET status = ?
       WHERE id = ?`,
      [MENTOR_STATUS_ACTIVE, id]
    );

    const mentor = await getMentorById(id);

    return {
      outcome: 'approved',
      mentor,
    };
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return { outcome: 'status_column_missing' };
    }

    throw err;
  }
}

async function moveMentorToPendingById(id) {
  try {
    const [rows] = await db.query(
      `SELECT id, status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return { outcome: 'not_found' };
    }

    const currentStatus = String(rows[0].status || '').trim().toLowerCase();

    if (currentStatus === MENTOR_STATUS_PENDING) {
      const mentor = await getMentorById(id);
      return { outcome: 'already_pending', mentor };
    }

    if (currentStatus && currentStatus !== MENTOR_STATUS_ACTIVE) {
      return { outcome: 'invalid_status', status: currentStatus };
    }

    await db.query(
      `UPDATE ${MENTOR_REGISTRATION_TABLE}
       SET status = ?
       WHERE id = ?`,
      [MENTOR_STATUS_PENDING, id]
    );

    const mentor = await getMentorById(id);

    return {
      outcome: 'moved_to_pending',
      mentor,
    };
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return { outcome: 'status_column_missing' };
    }

    throw err;
  }
}

async function rejectMentorById(id) {
  const [result] = await db.query(
    `DELETE FROM ${MENTOR_REGISTRATION_TABLE}
     WHERE id = ?`,
    [id]
  );

  if (!result || Number(result.affectedRows || 0) === 0) {
    return { outcome: 'not_found' };
  }

  return { outcome: 'deleted' };
}

async function getMentorFileById(id, column) {
  if (!FILE_COLUMNS.has(column)) {
    throw new Error('Invalid file column');
  }

  const [rows] = await db.query(
    `SELECT ${column}
     FROM ${MENTOR_REGISTRATION_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (rows.length === 0) {
    return { found: false, file: null };
  }

  return {
    found: true,
    file: rows[0][column] || null,
  };
}

module.exports = {
  createPaymentOrder,
  verifyPaymentForRegistration,
  isMentorEmailTaken,
  createMentorRegistration,
  getMentorById,
  getMentorFileById,
  getPendingMentors,
  getActiveMentors,
  approveMentorById,
  moveMentorToPendingById,
  rejectMentorById,
};
