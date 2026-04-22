function moduleErrorHandler(err, req, res, next) {
  const statusCode = Number(err.statusCode) || 500;
  const message = err.message || 'Internal server error';

  if (statusCode >= 500) {
    console.error('Bulk mail service error:', err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    details: err.details || undefined,
  });
}

module.exports = moduleErrorHandler;
