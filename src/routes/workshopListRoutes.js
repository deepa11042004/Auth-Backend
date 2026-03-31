const express = require('express');
const workshopListController = require('../controllers/workshopListController');
const { uploadWorkshopImages } = require('../middleware/workshopImageUpload');

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
 *         multipart/form-data:
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
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *               certificate_file:
 *                 type: string
 *                 format: binary
 *                 description: Certificate image file (certificate field is also accepted as an alias).
 *               thumbnail_url:
 *                 type: string
 *               certificate_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Workshop created successfully
 */
router.post('/workshop-list/create', uploadWorkshopImages, workshopListController.createWorkshop);

/**
 * @openapi
 * /api/workshop-list/{id}/thumbnail:
 *   get:
 *     tags: [Workshops]
 *     summary: Fetch a workshop thumbnail image
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Thumbnail image (webp)
 *         content:
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/workshop-list/:id/thumbnail', workshopListController.getWorkshopThumbnail);

/**
 * @openapi
 * /api/workshop-list/{id}/certificate:
 *   get:
 *     tags: [Workshops]
 *     summary: Fetch a workshop certificate image
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Certificate image (webp)
 *         content:
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/workshop-list/:id/certificate', workshopListController.getWorkshopCertificate);

module.exports = router;
