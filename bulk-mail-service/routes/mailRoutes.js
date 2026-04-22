const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const moduleErrorHandler = require('../utils/errorMiddleware');
const controller = require('../controllers/mailController');

const router = express.Router();

router.post('/single', asyncHandler(controller.sendSingleEmail));
router.post('/bulk/raw', asyncHandler(controller.sendBulkRawEmail));
router.post('/bulk/auto', asyncHandler(controller.sendBulkAutoEmail));
router.post('/bulk/template', asyncHandler(controller.sendBulkTemplateEmail));

router.post('/templates/preview', asyncHandler(controller.templatePreview));
router.get('/status/:jobId', asyncHandler(controller.emailJobStatus));
router.get('/logs', asyncHandler(controller.emailLogs));
router.post('/retry/:jobId', asyncHandler(controller.retryFailedEmailJob));

router.use(moduleErrorHandler);

module.exports = router;
