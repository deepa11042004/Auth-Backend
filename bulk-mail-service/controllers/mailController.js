const bulkMailService = require('../services/bulkMailService');
const { previewTemplate } = require('../services/templateService');
const { getJobStatus, retryFailedJob } = require('../services/queueService');
const { getEmailLogs } = require('../db/emailLogRepository');
const { HttpError } = require('../utils/httpError');

async function sendSingleEmail(req, res) {
  const result = await bulkMailService.queueSingleEmail(req.body || {});

  return res.status(202).json({
    success: true,
    message: 'Single email queued',
    data: result,
  });
}

async function sendBulkRawEmail(req, res) {
  const result = await bulkMailService.queueBulkRaw(req.body || {});

  return res.status(202).json({
    success: true,
    message: 'Bulk raw email jobs queued',
    data: result,
  });
}

async function sendBulkAutoEmail(req, res) {
  const result = await bulkMailService.queueBulkAuto(req.body || {});

  return res.status(202).json({
    success: true,
    message: 'Bulk personalized email jobs queued',
    data: result,
  });
}

async function sendBulkTemplateEmail(req, res) {
  const result = await bulkMailService.queueBulkTemplate(req.body || {});

  return res.status(202).json({
    success: true,
    message: 'Template-based bulk email jobs queued',
    data: result,
  });
}

async function templatePreview(req, res) {
  const result = await previewTemplate(req.body || {});

  return res.status(200).json({
    success: true,
    message: 'Template preview generated',
    data: result,
  });
}

async function emailJobStatus(req, res) {
  const result = await getJobStatus(req.params.jobId);

  return res.status(200).json({
    success: true,
    message: 'Job status fetched',
    data: result,
  });
}

async function emailLogs(req, res) {
  const status = req.query.status;

  if (status && status !== 'sent' && status !== 'failed') {
    throw new HttpError(400, "status must be either 'sent' or 'failed'");
  }

  const limitValue = req.query.limit !== undefined ? Number(req.query.limit) : 100;
  const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 500) : 100;

  const rows = await getEmailLogs({
    status,
    email: req.query.email,
    limit,
  });

  return res.status(200).json({
    success: true,
    message: 'Email logs fetched',
    data: rows,
  });
}

async function retryFailedEmailJob(req, res) {
  const result = await retryFailedJob(req.params.jobId);

  return res.status(200).json({
    success: true,
    message: 'Failed job retried',
    data: result,
  });
}

module.exports = {
  sendSingleEmail,
  sendBulkRawEmail,
  sendBulkAutoEmail,
  sendBulkTemplateEmail,
  templatePreview,
  emailJobStatus,
  emailLogs,
  retryFailedEmailJob,
};
