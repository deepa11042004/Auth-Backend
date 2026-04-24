const Razorpay = require('razorpay');
const crypto = require('crypto');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

let razorpay;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

/**
 * Creates a Razorpay order.
 * @param {number} amount In INR (rupees). It will be converted to paise internally.
 * @param {string} receipt Receipt ID or Registration ID.
 */
async function createOrder(amount, receipt) {
  if (!razorpay) {
    throw new Error('Razorpay is not configured');
  }

  const options = {
    amount: Math.round(amount * 100), // convert to paise
    currency: 'INR',
    receipt: String(receipt),
  };

  const order = await razorpay.orders.create(options);
  return order;
}

/**
 * Verifies Razorpay payment signature.
 */
function verifySignature(order_id, payment_id, signature) {
  const body = order_id + '|' + payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Validates Razorpay Webhook signature.
 */
function verifyWebhookSignature(webhookBody, webhookSignature, webhookSecret) {
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(webhookBody)
    .digest('hex');

  return expectedSignature === webhookSignature;
}

/**
 * Fetches a payment by ID (Optional utility)
 */
async function getPayment(payment_id) {
  if (!razorpay) {
    throw new Error('Razorpay is not configured');
  }
  return await razorpay.payments.fetch(payment_id);
}

module.exports = {
  createOrder,
  verifySignature,
  verifyWebhookSignature,
  getPayment,
};
