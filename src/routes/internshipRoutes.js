const express = require('express');

const internshipRegistrationController = require('../controllers/internshipRegistrationController');
const { uploadInternshipPhoto } = require('../middleware/internshipPhotoUpload');

const router = express.Router();

/**
 * @openapi
 * /api/internship/registration/create-order:
 *   post:
 *     tags: [Internships]
 *     summary: Create Razorpay order for internship application fee
 */
router.post(
  '/internship/registration/create-order',
  internshipRegistrationController.createPaymentOrder
);

/**
 * @openapi
 * /api/internship/registration/verify-payment:
 *   post:
 *     tags: [Internships]
 *     summary: Verify Razorpay payment and submit internship application
 */
router.post(
  '/internship/registration/verify-payment',
  uploadInternshipPhoto,
  internshipRegistrationController.verifyPaymentAndRegister
);

/**
 * @openapi
 * /api/internship/registration/register:
 *   post:
 *     tags: [Internships]
 *     summary: Submit internship application without payment when fee is zero
 */
router.post(
  '/internship/registration/register',
  uploadInternshipPhoto,
  internshipRegistrationController.registerWithoutPayment
);

/**
 * @openapi
 * /api/internship/registration/list:
 *   get:
 *     tags: [Internships]
 *     summary: Get internship applications for admin panel
 */
router.get(
  '/internship/registration/list',
  internshipRegistrationController.getInternshipRegistrations
);

module.exports = router;
