const {
  createRegistration,
  updateRegistrationOrder,
  updatePaymentStatusByOrder,
} = require('../models/Registration');
const razorpayService = require('../services/razorpayService');

// Usually amounts might depend on the form type or data.
// For demonstration/fail-safe, let's assume we expect amount from the request or map it here.
// In a real app, you should calculate amount based on `type` securely.
async function register(req, res, next) {
  try {
    const { type, user_data, amount } = req.body;

    if (!type || !user_data || !amount) {
      return res.status(400).json({ success: false, message: 'Missing type, user_data, or amount' });
    }

    console.log(`[Registration] Creating pending registration for type: ${type}`);
    // 1. Data-First Approach: Save to DB before anything else.
    const registration = await createRegistration({ type, user_data });
    
    // 2. Create Razorpay Order
    console.log(`[Registration] Creating Razorpay order for registration ID: ${registration.id}`);
    const order = await razorpayService.createOrder(amount, registration.id);

    // 3. Update DB with order_id
    await updateRegistrationOrder(registration.id, order.id);

    console.log(`[Registration] Order ${order.id} created successfully`);
    return res.status(201).json({
      success: true,
      message: 'Registration initiated successfully',
      data: {
        registration_id: registration.id,
        order_id: order.id,
        amount: order.amount, // in paise
        currency: order.currency,
      }
    });

  } catch (error) {
    console.error('[Registration] Error creating registration:', error);
    next(error);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    console.log(`[Payment] Verifying payment for order: ${razorpay_order_id}`);

    const isValid = razorpayService.verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (isValid) {
      console.log(`[Payment] Signature valid. Marking as success: ${razorpay_order_id}`);
      await updatePaymentStatusByOrder(razorpay_order_id, 'success', razorpay_payment_id);
      return res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
      console.warn(`[Payment] Invalid signature. Marking as failed: ${razorpay_order_id}`);
      await updatePaymentStatusByOrder(razorpay_order_id, 'failed');
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('[Payment] Error verifying payment:', error);
    next(error);
  }
}

async function handleWebhook(req, res, next) {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('[Webhook] RAZORPAY_WEBHOOK_SECRET not set. Skipping webhook.');
      return res.status(200).send('OK');
    }

    const isValid = razorpayService.verifyWebhookSignature(
      req.rawBody,
      webhookSignature,
      webhookSecret
    );

    if (!isValid) {
      console.warn('[Webhook] Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    const { event, payload } = req.body;
    console.log(`[Webhook] Received event: ${event}`);

    const paymentEntity = payload.payment.entity;
    const order_id = paymentEntity.order_id;
    const payment_id = paymentEntity.id;

    if (event === 'payment.captured') {
      console.log(`[Webhook] Payment captured for order: ${order_id}`);
      await updatePaymentStatusByOrder(order_id, 'success', payment_id);
    } else if (event === 'payment.failed') {
      console.log(`[Webhook] Payment failed for order: ${order_id}`);
      await updatePaymentStatusByOrder(order_id, 'failed', payment_id);
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error handling webhook:', error);
    next(error);
  }
}

// Optional API to manually fetch and sync payment using Razorpay payment_id
async function syncPayment(req, res, next) {
  try {
    const { payment_id } = req.params;
    
    if (!payment_id) {
      return res.status(400).json({ success: false, message: 'Missing payment_id' });
    }

    const payment = await razorpayService.getPayment(payment_id);
    const order_id = payment.order_id;

    if (payment.status === 'captured') {
      await updatePaymentStatusByOrder(order_id, 'success', payment_id);
    } else if (payment.status === 'failed') {
      await updatePaymentStatusByOrder(order_id, 'failed', payment_id);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment synced successfully',
      data: { status: payment.status, order_id }
    });

  } catch (error) {
    console.error('[Sync] Error syncing payment:', error);
    next(error);
  }
}

module.exports = {
  register,
  verifyPayment,
  handleWebhook,
  syncPayment
};
