const multer = require('multer');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      const error = new Error('Only image files (jpg, jpeg, png, webp) are allowed.');
      error.code = 'UNSUPPORTED_IMAGE_TYPE';
      return cb(error);
    }
    return cb(null, true);
  },
});

function uploadWorkshopImages(req, res, next) {
  const handler = upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'certificate', maxCount: 1 },
    { name: 'certificate_file', maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'Image file too large. Max size is 2MB.',
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field. Use thumbnail or certificate (certificate_file alias allowed).',
        });
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files uploaded. Provide at most one thumbnail and one certificate.',
        });
      }

      return res.status(400).json({
        success: false,
        message: `Invalid upload: ${err.message}`,
      });
    }

    if (err.code === 'UNSUPPORTED_IMAGE_TYPE') {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    console.error('Workshop image upload error:', err);
    return res.status(400).json({
      success: false,
      message: 'Failed to upload images.',
    });
  });
}

module.exports = {
  uploadWorkshopImages,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
};
