const env = require('../config/env');
const { emailQueue } = require('../queues/emailQueue');
const { HttpError } = require('../utils/httpError');

async function addEmailJob(payload, options) {
  const job = await emailQueue.add('send-email', payload, {
    attempts: env.queueAttempts,
    ...(options || {}),
  });

  return job;
}

async function addBulkEmailJobs(payloads, options) {
  if (!Array.isArray(payloads) || !payloads.length) {
    return [];
  }

  const jobIdPrefix = options && options.jobIdPrefix ? options.jobIdPrefix : null;
  const { jobIdPrefix: _, ...jobOptions } = options || {};

  const bulkJobs = payloads.map((payload, index) => ({
    name: 'send-email',
    data: payload,
    opts: {
      attempts: env.queueAttempts,
      ...jobOptions,
      jobId: jobIdPrefix ? `${jobIdPrefix}-${Date.now()}-${index}` : undefined,
    },
  }));

  return emailQueue.addBulk(bulkJobs);
}

async function getJobStatus(jobId) {
  const job = await emailQueue.getJob(jobId);

  if (!job) {
    throw new HttpError(404, `Job '${jobId}' not found`);
  }

  const state = await job.getState();

  return {
    id: String(job.id),
    name: job.name,
    state,
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason || null,
    data: job.data,
    result: job.returnvalue || null,
  };
}

async function retryFailedJob(jobId) {
  const job = await emailQueue.getJob(jobId);

  if (!job) {
    throw new HttpError(404, `Job '${jobId}' not found`);
  }

  const state = await job.getState();

  if (state !== 'failed') {
    throw new HttpError(400, `Only failed jobs can be retried. Current state: ${state}`);
  }

  await job.retry();

  return {
    id: String(job.id),
    state: 'waiting',
  };
}

module.exports = {
  addEmailJob,
  addBulkEmailJobs,
  getJobStatus,
  retryFailedJob,
};
