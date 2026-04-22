const IORedis = require('ioredis');
const env = require('./env');
const logger = require('../utils/moduleLogger');

const redisConnection = new IORedis({
  host: env.redisHost,
  port: env.redisPort,
  password: env.redisPassword,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redisConnection.on('error', (error) => {
  logger.error('Redis connection error', { message: error.message });
});

module.exports = redisConnection;
