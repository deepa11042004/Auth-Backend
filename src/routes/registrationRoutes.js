const express = require('express');
const {
  register,
  verifyPayment,
  handleWebhook,
  syncPayment
} = require('../controllers/registrationController');

const router = express.Router();

// Public routes for registration and payments
router.post('/register', register);
router.post('/payment/verify', verifyPayment);
router.get('/payment/sync/:payment_id', syncPayment);

// Razorpay webhook endpoint (must not use body parsing middleware that changes raw body if verifying strictly,
// but for standard express.json() with stringify it often works if handled correctly.
// A common practice is to use express.raw for webhooks if signature verification fails with express.json)
router.post('/webhook', handleWebhook);

module.exports = router;
