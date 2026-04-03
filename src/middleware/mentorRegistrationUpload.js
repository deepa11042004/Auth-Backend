const multer = require('multer');

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ALLOWED_RESUME_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_PROFILE_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'resume') {
      if (!ALLOWED_RESUME_MIME_TYPES.has(file.mimetype)) {
        const error = new Error('Invalid resume file type. Use PDF, DOC, or DOCX.');
        error.code = 'UNSUPPORTED_RESUME_TYPE';
        return cb(error);
      }

      return cb(null, true);
    }

    if (file.fieldname === 'profile_photo') {
      if (!ALLOWED_PROFILE_PHOTO_MIME_TYPES.has(file.mimetype)) {
        const error = new Error('Invalid profile photo type. Use JPG, PNG, or WEBP image.');
        error.code = 'UNSUPPORTED_PROFILE_PHOTO_TYPE';
        return cb(error);
      }

      return cb(null, true);
    }

    const error = new Error('Unexpected file field. Allowed fields are resume and profile_photo.');
    error.code = 'UNEXPECTED_MENTOR_FILE_FIELD';
    return cb(error);
  },
});

function uploadMentorRegistrationFiles(req, res, next) {
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.startsWith('multipart/form-data')) {
    // For non-file JSON payloads, bypass multer and continue.
    return next();
  }

  const handler = upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'profile_photo', maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large. Max size is 5MB per file.',
        });
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          error: 'Too many files uploaded. Use only resume and profile_photo.',
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Unexpected file field. Allowed fields are resume and profile_photo.',
        });
      }

      return res.status(400).json({
        error: `Invalid upload: ${err.message}`,
      });
    }

    if (
      err.code === 'UNSUPPORTED_RESUME_TYPE'
      || err.code === 'UNSUPPORTED_PROFILE_PHOTO_TYPE'
      || err.code === 'UNEXPECTED_MENTOR_FILE_FIELD'
    ) {
      return res.status(400).json({
        error: err.message,
      });
    }

    console.error('Mentor upload error:', err);
    return res.status(400).json({
      error: 'Failed to process uploaded files.',
    });
  });
}

module.exports = {
  uploadMentorRegistrationFiles,
};
