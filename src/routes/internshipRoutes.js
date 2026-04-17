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

/**
 * @openapi
 * /api/internship/registration/fee:
 *   get:
 *     tags: [Internships]
 *     summary: Get configurable internship fees for general and lateral registration
 *   put:
 *     tags: [Internships]
 *     summary: Update configurable internship fees for general and lateral registration
 */
router.get(
  '/internship/registration/fee',
  internshipRegistrationController.getInternshipFeeSettings
);

router.put(
  '/internship/registration/fee',
  internshipRegistrationController.updateInternshipFeeSettings
);

/**
 * @openapi
 * /api/internship/registration/{id}:
 *   delete:
 *     tags: [Internships]
 *     summary: Delete an internship registration entry by id
 */
router.delete(
  '/internship/registration/:id',
  internshipRegistrationController.deleteInternshipRegistration
);

/**
 * @openapi
 * /api/internship/registration/{id}/payment-status:
 *   patch:
 *     tags: [Internships]
 *     summary: Transfer internship registration payment status to failed or captured
 */
router.patch(
  '/internship/registration/:id/payment-status',
  internshipRegistrationController.transferInternshipRegistrationPaymentStatus
);

module.exports = router;
