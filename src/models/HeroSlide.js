const db = require('../config/db');

const HERO_SLIDE_TABLE = 'hero_slides';
const HERO_MEDIA_TYPES = Object.freeze({
  IMAGE: 'image',
  VIDEO: 'video',
});

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;

function cleanText(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }

  return typeof value === 'string' ? value.trim() : '';
}

function toNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function toNullableInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(numeric);
}

function normalizeMediaType(value, file) {
  const explicitType = cleanText(value).toLowerCase();
  if (explicitType === HERO_MEDIA_TYPES.IMAGE || explicitType === HERO_MEDIA_TYPES.VIDEO) {
    return explicitType;
  }

  const mimeType = typeof file?.mimetype === 'string' ? file.mimetype.toLowerCase() : '';
  if (mimeType.startsWith('image/')) {
    return HERO_MEDIA_TYPES.IMAGE;
  }

  if (mimeType.startsWith('video/')) {
    return HERO_MEDIA_TYPES.VIDEO;
  }

  return '';
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const cleaned = String(value).trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(cleaned)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(cleaned)) {
    return false;
  }

  return fallback;
}

function formatDateTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const asString = String(value).trim();
  return asString || null;
}

function normalizeHeroSlidePayload(input = {}, options = {}) {
  const file = options.file && typeof options.file === 'object' ? options.file : null;
  const mediaType = normalizeMediaType(input.media_type || input.mediaType, file);

  const payload = {
    title: cleanText(input.title),
    subtitle: toNullableText(input.subtitle),
    media_type: mediaType,
    media_data: file && Buffer.isBuffer(file.buffer) ? file.buffer : null,
    media_mime_type: toNullableText(file ? file.mimetype : null),
    cta_text: toNullableText(input.cta_text || input.ctaText),
    cta_link: toNullableText(input.cta_link || input.ctaLink),
    is_active: toBoolean(input.is_active ?? input.isActive, true),
    position: toNullableInteger(input.position),
  };

  const errors = [];

  if (!payload.title) {
    errors.push('title is required');
  }

  if (!payload.media_type) {
    errors.push('media_type is required and must be image or video');
  }

  if (!payload.media_data) {
    errors.push('media file is required');
  }

  if (!payload.media_mime_type) {
    errors.push('media MIME type is required');
  }

  if (payload.position !== null && payload.position < 1) {
    errors.push('position must be a positive integer');
  }

  if (payload.media_mime_type && payload.media_type) {
    const mime = payload.media_mime_type.toLowerCase();

    if (payload.media_type === HERO_MEDIA_TYPES.IMAGE && !mime.startsWith('image/')) {
      errors.push('media_type image requires an image/* file');
    }

    if (payload.media_type === HERO_MEDIA_TYPES.VIDEO && !mime.startsWith('video/')) {
      errors.push('media_type video requires a video/* file');
    }
  }

  if (payload.media_data && payload.media_type === HERO_MEDIA_TYPES.IMAGE) {
    if (payload.media_data.length > IMAGE_MAX_BYTES) {
      errors.push('image media exceeds 2MB limit');
    }
  }

  if (payload.media_data && payload.media_type === HERO_MEDIA_TYPES.VIDEO) {
    if (payload.media_data.length > VIDEO_MAX_BYTES) {
      errors.push('video media exceeds 20MB limit');
    }
  }

  return { payload, errors };
}

async function ensureHeroSlidesTable(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${HERO_SLIDE_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NULL,
      media_type ENUM('image', 'video') NOT NULL,
      media_data LONGBLOB NOT NULL,
      media_mime_type VARCHAR(120) NOT NULL,
      cta_text VARCHAR(255) NULL,
      cta_link TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      position INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_hero_slides_active_position (is_active, position),
      INDEX idx_hero_slides_position (position)
    )`
  );
}

function mapHeroSlideRow(row) {
  return {
    id: Number(row.id),
    title: cleanText(row.title),
    subtitle: toNullableText(row.subtitle),
    media_type: cleanText(row.media_type),
    media_mime_type: toNullableText(row.media_mime_type),
    cta_text: toNullableText(row.cta_text),
    cta_link: toNullableText(row.cta_link),
    is_active: Number(row.is_active) === 1,
    position: Number(row.position),
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  };
}

async function getNextPosition(connection = db) {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM ${HERO_SLIDE_TABLE}`
  );

  return Number(rows?.[0]?.next_position || 1);
}

async function createHeroSlide(payload, connection = db) {
  const resolvedPosition = payload.position === null ? await getNextPosition(connection) : payload.position;

  const columns = [
    'title',
    'subtitle',
    'media_type',
    'media_data',
    'media_mime_type',
    'cta_text',
    'cta_link',
    'is_active',
    'position',
  ];

  const values = [
    payload.title,
    payload.subtitle,
    payload.media_type,
    payload.media_data,
    payload.media_mime_type,
    payload.cta_text,
    payload.cta_link,
    payload.is_active ? 1 : 0,
    resolvedPosition,
  ];

  const placeholders = columns.map(() => '?').join(', ');

  const [insertResult] = await connection.query(
    `INSERT INTO ${HERO_SLIDE_TABLE} (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );

  const createdId = Number(insertResult.insertId);
  const [rows] = await connection.query(
    `SELECT id,
            title,
            subtitle,
            media_type,
            media_mime_type,
            cta_text,
            cta_link,
            is_active,
            position,
            created_at,
            updated_at
     FROM ${HERO_SLIDE_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [createdId]
  );

  return rows[0] ? mapHeroSlideRow(rows[0]) : null;
}

async function getHeroSlides(options = {}, connection = db) {
  const activeOnly = Boolean(options.activeOnly);

  const [rows] = activeOnly
    ? await connection.query(
      `SELECT id,
              title,
              subtitle,
              media_type,
              media_mime_type,
              cta_text,
              cta_link,
              is_active,
              position,
              created_at,
              updated_at
       FROM ${HERO_SLIDE_TABLE}
       WHERE is_active = 1
       ORDER BY position ASC, id ASC`
    )
    : await connection.query(
      `SELECT id,
              title,
              subtitle,
              media_type,
              media_mime_type,
              cta_text,
              cta_link,
              is_active,
              position,
              created_at,
              updated_at
       FROM ${HERO_SLIDE_TABLE}
       ORDER BY position ASC, id ASC`
    );

  return rows.map(mapHeroSlideRow);
}

async function getHeroSlideMediaById(id, connection = db) {
  const [rows] = await connection.query(
    `SELECT id,
            media_data,
            media_mime_type,
            media_type,
            is_active
     FROM ${HERO_SLIDE_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    media_data: Buffer.isBuffer(row.media_data) ? row.media_data : null,
    media_mime_type: toNullableText(row.media_mime_type),
    media_type: cleanText(row.media_type),
    is_active: Number(row.is_active) === 1,
  };
}

async function deleteHeroSlideById(id, connection = db) {
  const [result] = await connection.query(
    `DELETE FROM ${HERO_SLIDE_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return Number(result.affectedRows) > 0;
}

module.exports = {
  HERO_SLIDE_TABLE,
  HERO_MEDIA_TYPES,
  normalizeHeroSlidePayload,
  ensureHeroSlidesTable,
  createHeroSlide,
  getHeroSlides,
  getHeroSlideMediaById,
  deleteHeroSlideById,
};
