const express = require('express');

const institutionalRegistrationController = require('../controllers/institutionalRegistrationController');

const router = express.Router();

/**
 * @openapi
 * /api/institutional-registration:
 *   post:
 *     tags: [Institutional Registrations]
 *     summary: Submit institutional registration form
 *   get:
 *     tags: [Institutional Registrations]
 *     summary: Get all institutional registration applications for admin panel
 */
router.post(
  '/institutional-registration/create-order',
  institutionalRegistrationController.createInstitutionalPaymentOrder
);

router.post(
  '/institutional-registration/verify-payment',
  institutionalRegistrationController.verifyInstitutionalPaymentAndRegister
);

router.post(
  '/institutional-registration/log-payment-attempt',
  institutionalRegistrationController.logInstitutionalPaymentAttempt
);

router.post(
  '/institutional-registration',
  institutionalRegistrationController.createInstitutionalRegistration
);

router.get(
  '/institutional-registration',
  institutionalRegistrationController.getInstitutionalRegistrations
);

module.exports = router;
