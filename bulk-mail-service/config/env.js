function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

const env = {
  awsAccessKey: process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretKey: process.env.AWS_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  sesRegion: process.env.SES_REGION || 'us-east-1',
  emailFrom: process.env.EMAIL_FROM || '',

  dbHost: process.env.DB_HOST || '127.0.0.1',
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || '',
  bulkMailDbName:
    process.env.BULK_MAIL_DB_NAME ||
    process.env.BULK_DB_NAME ||
    process.env.DB_NAME ||
    '',
  recipientDbName:
    process.env.BULK_MAIL_SOURCE_DB_NAME ||
    process.env.RECIPIENT_DB_NAME ||
    process.env.DB_NAME ||
    '',
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbConnectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,

  redisHost: process.env.REDIS_HOST || '127.0.0.1',
  redisPort: Number(process.env.REDIS_PORT) || 6379,
  redisPassword: process.env.REDIS_PASSWORD || undefined,

  queueName: process.env.EMAIL_QUEUE_NAME || 'bulk-email-queue',
  queueAttempts: Number(process.env.EMAIL_QUEUE_ATTEMPTS) || 3,
  queueRateLimitMax: Number(process.env.EMAIL_RATE_LIMIT_MAX) || 15,
  queueRateLimitDurationMs: Number(process.env.EMAIL_RATE_LIMIT_DURATION_MS) || 1000,
  queueFetchChunkSize: Number(process.env.EMAIL_FETCH_CHUNK_SIZE) || 500,
  workerConcurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY) || 5,
  bullmqSkipRedisVersionCheck: parseBoolean(
    process.env.BULLMQ_SKIP_REDIS_VERSION_CHECK,
    true
  ),
};

module.exports = env;
