const { Worker } = require('bullmq');
const env = require('../config/env');
const redisConnection = require('../config/redis');
const logger = require('../utils/moduleLogger');
const { sendEmail } = require('../services/sesService');
const { insertEmailLog } = require('../db/emailLogRepository');

let workerInstance = null;

async function processEmailJob(job) {
  const data = job.data || {};
  const email = data.email;
  const subject = data.subject;
  const html = data.html;

  console.log('[emailWorker] Starting job', {
    jobId: job.id,
    email,
    subject,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts || env.queueAttempts,
  });

  try {
    await sendEmail(email, subject, html);
    console.log('[emailWorker] Email sent successfully', { jobId: job.id, email, subject });

    await insertEmailLog({
      email,
      subject,
      status: 'sent',
      error: null,
    });
    console.log('[emailWorker] Email log inserted', { jobId: job.id, email, status: 'sent' });

    return {
      success: true,
      email,
    };
  } catch (error) {
    const configuredAttempts = Number(job.opts.attempts) || env.queueAttempts;
    const isFinalAttempt = job.attemptsMade + 1 >= configuredAttempts;

    console.log('[emailWorker] Job failed', {
      jobId: job.id,
      email,
      subject,
      attemptsMade: job.attemptsMade,
      configuredAttempts,
      error: error.message,
    });

    if (isFinalAttempt) {
      console.log('[emailWorker] Final attempt reached, writing failed status to email log', {
        jobId: job.id,
        email,
      });
      try {
        await insertEmailLog({
          email,
          subject,
          status: 'failed',
          error: (error.message || 'Unknown error').slice(0, 65535),
        });
        console.log('[emailWorker] Failed email log inserted', { jobId: job.id, email, status: 'failed' });
      } catch (dbError) {
        logger.error('Failed to write failed email log', {
          message: dbError.message,
        });
        console.log('[emailWorker] Failed to insert failed email log', { jobId: job.id, error: dbError.message });
      }
    }

    throw error;
  }
}

function initializeEmailWorker() {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(env.queueName, processEmailJob, {
    connection: redisConnection,
    skipVersionCheck: env.bullmqSkipRedisVersionCheck,
    concurrency: env.workerConcurrency,
    limiter: {
      max: env.queueRateLimitMax,
      duration: env.queueRateLimitDurationMs,
    },
  });

  workerInstance.on('ready', () => {
    logger.info('Email worker ready', {
      queue: env.queueName,
      concurrency: env.workerConcurrency,
      limiterMax: env.queueRateLimitMax,
      limiterDuration: env.queueRateLimitDurationMs,
    });
    console.log('[emailWorker] Ready', {
      queue: env.queueName,
      concurrency: env.workerConcurrency,
      limiterMax: env.queueRateLimitMax,
      limiterDuration: env.queueRateLimitDurationMs,
    });
  });

  workerInstance.on('failed', (job, error) => {
    logger.error('Email worker job failed', {
      jobId: job ? String(job.id) : null,
      email: job && job.data ? job.data.email : null,
      attemptsMade: job ? job.attemptsMade : null,
      message: error.message,
    });
    console.log('[emailWorker] Job failed event', {
      jobId: job ? String(job.id) : null,
      email: job && job.data ? job.data.email : null,
      attemptsMade: job ? job.attemptsMade : null,
      error: error.message,
    });
  });

  workerInstance.on('error', (error) => {
    logger.error('Email worker error', { message: error.message });
    console.log('[emailWorker] Worker error event', { message: error.message });
  });

  return workerInstance;
}

module.exports = {
  initializeEmailWorker,
};
