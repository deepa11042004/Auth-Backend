const express = require('express');

const summerSchoolController = require('../controllers/summerSchoolController');

const router = express.Router();

/**
 * @openapi
 * /api/summer-school/student-registration:
 *   post:
 *     tags: [Summer School]
 *     summary: Submit summer school student registration
 *   get:
 *     tags: [Summer School]
 *     summary: Get all summer school student registrations
 */
router.post(
  '/summer-school/student-registration/create-order',
  summerSchoolController.createPaymentOrder
);

router.post(
  '/summer-school/student-registration/verify-payment',
  summerSchoolController.verifyPaymentAndRegister
);

router.post(
  '/summer-school/student-registration',
  summerSchoolController.createStudentRegistration
);

router.get(
  '/summer-school/student-registration',
  summerSchoolController.getStudentRegistrations
);

router.get(
  '/summer-school/student-registration/settings',
  summerSchoolController.getSummerSchoolRegistrationSettings
);

router.put(
  '/summer-school/student-registration/settings',
  summerSchoolController.updateSummerSchoolRegistrationSettings
);

module.exports = router;