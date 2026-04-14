const express = require('express');

const mouRequestController = require('../controllers/mouRequestController');
const { uploadMouSupportingDocument } = require('../middleware/mouDocumentUpload');

const router = express.Router();

/**
 * @openapi
 * /api/mou-requests:
 *   post:
 *     tags: [MoU Requests]
 *     summary: Submit MoU proposal form
 *   get:
 *     tags: [MoU Requests]
 *     summary: Get all MoU requests for admin panel
 */
router.post('/mou-requests', uploadMouSupportingDocument, mouRequestController.createMouRequest);

router.get('/mou-requests', mouRequestController.getMouRequests);
router.get('/mou-requests/:id/document', mouRequestController.downloadMouRequestDocument);
router.delete('/mou-requests/:id', mouRequestController.deleteMouRequest);

module.exports = router;