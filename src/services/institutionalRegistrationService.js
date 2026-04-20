const crypto = require('crypto');
const Razorpay = require('razorpay');

const InstitutionalRegistration = require('../models/InstitutionalRegistration');

const SUCCESSFUL_PAYMENT_STATUSES = new Set(['captured', 'authorized']);
const TRANSIENT_PAYMENT_STATUSES = new Set(['created', 'pending']);
const PAYMENT_FETCH_RETRY_ATTEMPTS = 6;
const PAYMENT_FETCH_RETRY_DELAY_MS = 1200;

const INDIAN_PARTNERSHIP_AMOUNT = 2500;
const INTERNATIONAL_PARTNERSHIP_AMOUNT = 500;
const INDIAN_CURRENCY = 'INR';
const INTERNATIONAL_CURRENCY = 'USD';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCountry(value) {
  const normalized = cleanText(value).toLowerCase();

  if (normalized === 'india') {
    return 'India';
  }

  if (!normalized) {
    return '';
  }

  if (normalized === 'other' || normalized === 'others') {
    return 'Others';
  }

  return cleanText(value);
}

function resolveInstitutionPaymentConfig(country) {
  const normalizedCountry = normalizeCountry(country);

  if (!normalizedCountry) {
    return null;
  }

  if (normalizedCountry === 'India') {
    return {
      country: 'India',
      amount: INDIAN_PARTNERSHIP_AMOUNT,
      currency: INDIAN_CURRENCY,
      partnership_type: 'Institutional Partnership',
    };
  }

  return {
    country: normalizedCountry,
    amount: INTERNATIONAL_PARTNERSHIP_AMOUNT,
    currency: INTERNATIONAL_CURRENCY,
    partnership_type: 'International Partnership',
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

function buildValidationError(errors) {
  return {
    status: 400,
    body: {
      success: false,
      message: errors.join('. '),
      errors,
    },
  };
}

async function registerInstitution(payload) {
  await InstitutionalRegistration.ensureInstitutionalRegistrationTable();

  const {
    payload: normalizedPayload,
    errors,
  } = InstitutionalRegistration.normalizeInstitutionalRegistrationPayload(payload || {});

  if (errors.length > 0) {
    return buildValidationError(errors);
  }

  const resolvedPaymentStatus = cleanText(normalizedPayload.payment_status).toLowerCase() || 'pending';

  const registration = await InstitutionalRegistration.createInstitutionalRegistration(
    {
      ...normalizedPayload,
      payment_status: resolvedPaymentStatus,
    }
  );

  return {
    status: 201,
    body: {
      success: true,
      message:
        resolvedPaymentStatus === 'success'
          ? 'Institutional registration submitted successfully'
          : 'Institutional registration saved with pending payment status',
      data: registration,
    },
  };
}

async function createPaymentOrder(payload) {
  await InstitutionalRegistration.ensureInstitutionalRegistrationTable();

  const {
    payload: normalizedPayload,
    errors,
  } = InstitutionalRegistration.normalizeInstitutionalRegistrationPayload(payload || {});

  if (errors.length > 0) {
    return buildValidationError(errors);
  }

  const paymentConfig = resolveInstitutionPaymentConfig(normalizedPayload.country);

  if (!paymentConfig) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Unable to resolve payment amount for selected country',
      },
    };
  }

  const amountInMinorUnits = toMoneyInMinorUnits(paymentConfig.amount);

  if (amountInMinorUnits === null || amountInMinorUnits <= 0) {
    return {
      status: 500,
      body: {
        success: false,
        message: 'Invalid institutional registration fee configuration',
      },
    };
  }

  const { keyId } = getRazorpayCredentials();
  const razorpayClient = getRazorpayClient();

  if (!keyId || !razorpayClient) {
    return {
      status: 500,
      body: {
        success: false,
        message: 'Razorpay credentials are missing on the server',
      },
    };
  }

  const order = await razorpayClient.orders.create({
    amount: amountInMinorUnits,
    currency: paymentConfig.currency,
    receipt: `institutional_registration_${Date.now()}`,
    notes: {
      source: 'institutional_registration',
      applicant_email: normalizedPayload.email,
      country: paymentConfig.country,
      institute_name: normalizedPayload.institute_name,
    },
  });

  return {
    status: 201,
    body: {
      success: true,
      requires_payment: true,
      key_id: keyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      registration_fee: paymentConfig.amount,
      country: paymentConfig.country,
      partnership_type: paymentConfig.partnership_type,
    },
  };
}

async function verifyPaymentAndRegister(payload) {
  await InstitutionalRegistration.ensureInstitutionalRegistrationTable();

  const {
    payload: normalizedPayload,
    errors,
  } = InstitutionalRegistration.normalizeInstitutionalRegistrationPayload(payload || {});

  if (errors.length > 0) {
    return buildValidationError(errors);
  }

  const orderId = cleanText(payload?.razorpay_order_id || payload?.order_id);
  const paymentId = cleanText(payload?.razorpay_payment_id || payload?.payment_id);
  const signature = cleanText(payload?.razorpay_signature || payload?.signature);

  if (!orderId || !paymentId || !signature) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
      },
    };
  }

  const paymentConfig = resolveInstitutionPaymentConfig(normalizedPayload.country);

  if (!paymentConfig) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Unable to resolve payment amount for selected country',
      },
    };
  }

  const expectedAmountInMinorUnits = toMoneyInMinorUnits(paymentConfig.amount);

  if (expectedAmountInMinorUnits === null || expectedAmountInMinorUnits <= 0) {
    return {
      status: 500,
      body: {
        success: false,
        message: 'Invalid institutional registration fee configuration',
      },
    };
  }

  const { keySecret } = getRazorpayCredentials();
  const razorpayClient = getRazorpayClient();

  if (!keySecret || !razorpayClient) {
    return {
      status: 500,
      body: {
        success: false,
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
      body: {
        success: false,
        message: 'Invalid payment signature',
      },
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
        success: false,
        message: 'Unable to validate payment with Razorpay',
        ...(reason ? { reason } : {}),
      },
    };
  }

  if (String(payment.order_id) !== orderId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Payment does not belong to this order',
      },
    };
  }

  if (Number(payment.amount) !== expectedAmountInMinorUnits) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Paid amount does not match institutional registration fee',
      },
    };
  }

  const paymentCurrency = cleanText(payment.currency).toUpperCase();

  if (paymentCurrency !== paymentConfig.currency) {
    return {
      status: 400,
      body: {
        success: false,
        message: `Payment currency mismatch. Expected ${paymentConfig.currency}, received ${paymentCurrency || 'unknown'}`,
      },
    };
  }

  const paymentStatus = cleanText(payment.status).toLowerCase();

  if (!SUCCESSFUL_PAYMENT_STATUSES.has(paymentStatus)) {
    return {
      status: 400,
      body: {
        success: false,
        message: `Payment is not successful yet (status: ${paymentStatus || 'unknown'})`,
      },
    };
  }

  const registration = await InstitutionalRegistration.createInstitutionalRegistration({
    ...normalizedPayload,
    payment_status: 'success',
    payment_amount: expectedAmountInMinorUnits / 100,
    payment_currency: paymentConfig.currency,
    transaction_id: paymentId,
    failure_reason: null,
  });

  return {
    status: 201,
    body: {
      success: true,
      message: 'Payment verified and institutional registration submitted successfully',
      data: registration,
      payment: {
        amount: expectedAmountInMinorUnits / 100,
        currency: paymentConfig.currency,
        transaction_id: paymentId,
        status: 'success',
      },
    },
  };
}

async function logPaymentAttempt(payload) {
  await InstitutionalRegistration.ensureInstitutionalRegistrationTable();

  const {
    payload: normalizedPayload,
    errors,
  } = InstitutionalRegistration.normalizeInstitutionalRegistrationPayload(payload || {});

  if (errors.length > 0) {
    return buildValidationError(errors);
  }

  const paymentConfig = resolveInstitutionPaymentConfig(normalizedPayload.country);

  if (!paymentConfig) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Unable to resolve payment amount for selected country',
      },
    };
  }

  const failureReason = cleanText(
    payload?.failure_reason
    || payload?.failureReason
    || payload?.payment_error_description
    || payload?.payment_error_reason
    || payload?.payment_mode
    || 'Payment failed or cancelled by user'
  );

  const transactionId = cleanText(
    payload?.transaction_id
    || payload?.transactionId
    || payload?.razorpay_payment_id
    || payload?.payment_id
  ) || null;

  const registration = await InstitutionalRegistration.createInstitutionalRegistration({
    ...normalizedPayload,
    payment_status: 'failed',
    payment_amount: paymentConfig.amount,
    payment_currency: paymentConfig.currency,
    transaction_id: transactionId,
    failure_reason: failureReason || null,
  });

  return {
    status: 201,
    body: {
      success: true,
      message: 'Institutional registration stored with failed payment status',
      data: registration,
    },
  };
}

async function deleteInstitutionalRegistration(rawId) {
  await InstitutionalRegistration.ensureInstitutionalRegistrationTable();

  const numericId = Number(rawId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid institutional registration id',
      },
    };
  }

  const registration = await InstitutionalRegistration.deleteInstitutionalRegistration(
    numericId,
  );

  if (!registration) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Institutional registration not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Institutional application deleted successfully',
      data: registration,
    },
  };
}

async function listInstitutionalRegistrations() {
  await InstitutionalRegistration.ensureInstitutionalRegistrationTable();

  const registrations = await InstitutionalRegistration.getInstitutionalRegistrations();

  return {
    status: 200,
    body: {
      success: true,
      data: registrations,
    },
  };
}

module.exports = {
  registerInstitution,
  createPaymentOrder,
  verifyPaymentAndRegister,
  logPaymentAttempt,
  deleteInstitutionalRegistration,
  listInstitutionalRegistrations,
};
