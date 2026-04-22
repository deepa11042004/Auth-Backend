const { Queue, QueueEvents } = require('bullmq');
const env = require('../config/env');
const redisConnection = require('../config/redis');
const logger = require('../utils/moduleLogger');

const emailQueue = new Queue(env.queueName, {
  connection: redisConnection,
  skipVersionCheck: env.bullmqSkipRedisVersionCheck,
  defaultJobOptions: {
    attempts: env.queueAttempts,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

const queueEvents = new QueueEvents(env.queueName, {
  connection: redisConnection,
  skipVersionCheck: env.bullmqSkipRedisVersionCheck,
});

queueEvents.on('error', (error) => {
  logger.error('Queue events error', { message: error.message });
});

queueEvents.on('failed', (eventData) => {
  logger.warn('Queue job failed event', {
    jobId: eventData.jobId,
    failedReason: eventData.failedReason,
  });
});

module.exports = {
  emailQueue,
  queueEvents,
};
