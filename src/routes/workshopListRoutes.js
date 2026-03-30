const express = require('express');
const workshopListController = require('../controllers/workshopListController');

const router = express.Router();

/**
 * @openapi
 * /api/workshop-list/create:
 *   post:
 *     tags: [Workshops]
 *     summary: Create workshop entry in workshop_list
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               eligibility:
 *                 type: string
 *               mode:
 *                 type: string
 *               workshop_date:
 *                 type: string
 *                 example: 2026-04-30
 *               start_time:
 *                 type: string
 *                 example: 10:00:00
 *               end_time:
 *                 type: string
 *                 example: 12:00:00
 *               duration:
 *                 type: string
 *               certificate:
 *                 type: boolean
 *               fee:
 *                 type: number
 *               thumbnail_url:
 *                 type: string
 *               certificate_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Workshop created successfully
 */
router.post('/workshop-list/create', workshopListController.createWorkshop);

module.exports = router;
