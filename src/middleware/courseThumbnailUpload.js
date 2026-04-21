const fs = require('fs');
const path = require('path');
const multer = require('multer');

const COURSE_THUMBNAIL_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'courses');
const MAX_THUMBNAIL_SIZE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function sanitizeFileName(fileName) {
  return String(fileName || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

fs.mkdirSync(COURSE_THUMBNAIL_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, COURSE_THUMBNAIL_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = sanitizeFileName(path.basename(file.originalname || 'thumbnail', ext));
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base || 'thumbnail'}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_THUMBNAIL_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported thumbnail type. Allowed: JPG, PNG, WEBP'));
      return;
    }

    cb(null, true);
  },
});

function uploadCourseThumbnail(req, res, next) {
  upload.single('thumbnail')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'Thumbnail must be 8MB or smaller.',
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
      message: err.message || 'Thumbnail upload failed.',
    });
  });
}

module.exports = {
  uploadCourseThumbnail,
};
