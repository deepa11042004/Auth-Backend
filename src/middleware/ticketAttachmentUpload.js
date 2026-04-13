const fs = require('fs');
const path = require('path');
const multer = require('multer');

const TICKETS_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'tickets');
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

function sanitizeFileName(fileName) {
  return String(fileName || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

fs.mkdirSync(TICKETS_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TICKETS_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = sanitizeFileName(path.basename(file.originalname || 'attachment', ext));
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base || 'attachment'}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported attachment type. Allowed: JPG, PNG, WEBP, PDF, DOC, DOCX, TXT'));
      return;
    }

    cb(null, true);
  },
});

function uploadTicketAttachment(req, res, next) {
  upload.single('attachment')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'Attachment must be 5MB or smaller.',
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
      message: err.message || 'Attachment upload failed.',
    });
  });
}

module.exports = {
  uploadTicketAttachment,
};
