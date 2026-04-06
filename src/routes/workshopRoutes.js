const express = require('express');
const workshopRegistrationController = require('../controllers/workshopRegistrationController');

const router = express.Router();

/**
 * @openapi
 * /api/workshop/enrollment:
 *   post:
 *     tags: [Workshops]
 *     summary: Enroll a user for a workshop
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [full_name, email, contact_number, alternative_email, institution, designation, nationality, agree_recording, agree_terms]
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: Jane Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: jane@example.com
 *               contact_number:
 *                 type: string
 *                 example: 9876543210
 *               alternative_email:
 *                 type: string
 *                 format: email
 *                 example: jane.alt@example.com
 *               institution:
 *                 type: string
 *                 example: XYZ University
 *               designation:
 *                 type: string
 *                 enum: [Student, Faculty, Professional, Others]
 *                 example: Student
 *               nationality:
 *                 type: string
 *                 enum: [Indian, Others]
 *                 example: Indian
 *               agree_recording:
 *                 type: boolean
 *                 example: true
 *               agree_terms:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Workshop registration successful
 *       400:
 *         description: Validation error
 *       404:
 *         description: Workshop not found
 *       409:
 *         description: Duplicate workshop registration
 */
router.post('/workshop/enrollment', workshopRegistrationController.registerForWorkshop);
router.post('/workshop/enrollment/create-order', workshopRegistrationController.createPaymentOrder);
router.post('/workshop/enrollment/verify-payment', workshopRegistrationController.verifyPaymentAndRegister);

module.exports = router;
