const router = require('./routes/mailRoutes');
const { initializeEmailWorker } = require('./workers/emailWorker');
const logger = require('./utils/moduleLogger');

try {
  initializeEmailWorker();
} catch (error) {
  logger.error('Failed to initialize email worker', {
    message: error.message,
  });
}

module.exports = router;
