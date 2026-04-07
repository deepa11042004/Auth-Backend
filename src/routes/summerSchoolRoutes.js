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
  '/summer-school/student-registration',
  summerSchoolController.createStudentRegistration
);

router.get(
  '/summer-school/student-registration',
  summerSchoolController.getStudentRegistrations
);

module.exports = router;