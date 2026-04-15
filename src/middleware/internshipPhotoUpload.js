const multer = require('multer');

const MAX_PHOTO_BYTES = 800 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PHOTO_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
      const error = new Error('Invalid photo type. Use JPG, PNG, WEBP, HEIC, or HEIF.');
      error.code = 'UNSUPPORTED_PHOTO_TYPE';
      return cb(error);
    }

    return cb(null, true);
  },
});

function uploadInternshipPhoto(req, res, next) {
  const contentType = req.headers['content-type'] || '';

  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return next();
  }

  const handler = upload.fields([
    { name: 'passport_photo', maxCount: 1 },
    { name: 'passportPhoto', maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (!err) {
      const filesByField = req.files || {};
      const normalizedPhoto = (filesByField.passport_photo && filesByField.passport_photo[0])
        || (filesByField.passportPhoto && filesByField.passportPhoto[0])
        || null;

      if (normalizedPhoto) {
        req.internshipPhoto = normalizedPhoto;
      }

      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          message: 'Passport photo is too large. Max size is 800KB.',
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          message: 'Unexpected file field. Use passport_photo or passportPhoto.',
        });
      }

      return res.status(400).json({
        message: `Invalid upload: ${err.message}`,
      });
    }

    if (err.code === 'UNSUPPORTED_PHOTO_TYPE') {
      return res.status(400).json({
        message: err.message,
      });
    }

    console.error('Internship photo upload error:', err);
    return res.status(400).json({
      message: 'Failed to process passport photo upload.',
    });
  });
}

module.exports = {
  uploadInternshipPhoto,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_MIME_TYPES,
};
