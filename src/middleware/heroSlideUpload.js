const multer = require('multer');

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function isSupportedMediaMimeType(mimeType) {
  const value = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';
  return value.startsWith('image/') || value.startsWith('video/');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!isSupportedMediaMimeType(file.mimetype)) {
      cb(new Error('Unsupported media type. Allowed: image/*, video/*'));
      return;
    }

    cb(null, true);
  },
});

function uploadHeroSlideMedia(req, res, next) {
  const contentType = req.headers['content-type'];

  if (!contentType || !contentType.startsWith('multipart/form-data')) {
    return next();
  }

  upload.single('media')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'Media file must be 20MB or smaller.',
        });
        return;
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        res.status(400).json({
          success: false,
          message: 'Unexpected file field. Use media.',
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: err.message,
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: err.message || 'Hero media upload failed.',
    });
  });
}

module.exports = {
  uploadHeroSlideMedia,
};
