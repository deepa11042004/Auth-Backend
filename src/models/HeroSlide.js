const db = require('../config/db');

const HERO_SLIDE_TABLE = 'hero_slides';
const HERO_MEDIA_TYPES = Object.freeze({
  IMAGE: 'image',
  VIDEO: 'video',
});

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const HERO_OPTIONAL_COLUMNS = Object.freeze([
  {
    name: 'description',
    definition: 'TEXT NULL AFTER subtitle',
  },
  {
    name: 'badge_text',
    definition: 'VARCHAR(120) NULL AFTER description',
  },
  {
    name: 'secondary_cta_text',
    definition: 'VARCHAR(255) NULL AFTER cta_link',
  },
  {
    name: 'secondary_cta_link',
    definition: 'TEXT NULL AFTER secondary_cta_text',
  },
]);

function cleanText(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }

  return typeof value === 'string' ? value.trim() : '';
}

function hasOwnField(input, fieldNames) {
  if (!input || typeof input !== 'object') {
    return false;
  }

  return fieldNames.some((fieldName) =>
    Object.prototype.hasOwnProperty.call(input, fieldName)
  );
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
  const mediaData = file && Buffer.isBuffer(file.buffer) ? file.buffer : null;
  const mediaMimeType = toNullableText(file ? file.mimetype : null);

  const payload = {
    title: cleanText(input.title),
    subtitle: toNullableText(input.subtitle),
    description: toNullableText(input.description),
    badge_text: toNullableText(input.badge_text || input.badgeText),
    media_type: mediaType || null,
    media_data: mediaData,
    media_mime_type: mediaData ? mediaMimeType : null,
    cta_text: toNullableText(input.cta_text || input.ctaText),
    cta_link: toNullableText(input.cta_link || input.ctaLink),
    secondary_cta_text: toNullableText(
      input.secondary_cta_text || input.secondaryCtaText
    ),
    secondary_cta_link: toNullableText(
      input.secondary_cta_link || input.secondaryCtaLink
    ),
    is_active: toBoolean(input.is_active ?? input.isActive, true),
    position: toNullableInteger(input.position),
  };

  const errors = [];

  if (payload.media_data && !payload.media_type) {
    errors.push('media_type must be image or video when media file is uploaded');
  }

  if (payload.media_data && !payload.media_mime_type) {
    errors.push('media MIME type is required when media file is uploaded');
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

function normalizeHeroSlideUpdatePayload(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const file = options.file && typeof options.file === 'object' ? options.file : null;
  const existingSlide =
    options.existingSlide && typeof options.existingSlide === 'object'
      ? options.existingSlide
      : null;

  const updates = {};
  const errors = [];

  if (hasOwnField(source, ['title'])) {
    updates.title = cleanText(source.title);
  }

  if (hasOwnField(source, ['subtitle'])) {
    updates.subtitle = toNullableText(source.subtitle);
  }

  if (hasOwnField(source, ['description'])) {
    updates.description = toNullableText(source.description);
  }

  if (hasOwnField(source, ['badge_text', 'badgeText'])) {
    updates.badge_text = toNullableText(source.badge_text ?? source.badgeText);
  }

  if (hasOwnField(source, ['cta_text', 'ctaText'])) {
    updates.cta_text = toNullableText(source.cta_text ?? source.ctaText);
  }

  if (hasOwnField(source, ['cta_link', 'ctaLink'])) {
    updates.cta_link = toNullableText(source.cta_link ?? source.ctaLink);
  }

  if (hasOwnField(source, ['secondary_cta_text', 'secondaryCtaText'])) {
    updates.secondary_cta_text = toNullableText(
      source.secondary_cta_text ?? source.secondaryCtaText
    );
  }

  if (hasOwnField(source, ['secondary_cta_link', 'secondaryCtaLink'])) {
    updates.secondary_cta_link = toNullableText(
      source.secondary_cta_link ?? source.secondaryCtaLink
    );
  }

  if (hasOwnField(source, ['is_active', 'isActive'])) {
    const fallback = existingSlide ? Boolean(existingSlide.is_active) : true;
    updates.is_active = toBoolean(source.is_active ?? source.isActive, fallback);
  }

  if (hasOwnField(source, ['position'])) {
    const position = toNullableInteger(source.position);

    if (position !== null && position < 1) {
      errors.push('position must be a positive integer');
    } else {
      updates.position = position;
    }
  }

  const explicitMediaType = source.media_type ?? source.mediaType;
  const mediaTypeProvided = hasOwnField(source, ['media_type', 'mediaType']);

  if (file) {
    const resolvedMediaType = normalizeMediaType(explicitMediaType, file);
    const mediaMimeType = toNullableText(file.mimetype);
    const mediaData = Buffer.isBuffer(file.buffer) ? file.buffer : null;

    if (!resolvedMediaType) {
      errors.push('media_type is required and must be image or video');
    } else {
      updates.media_type = resolvedMediaType;
    }

    if (!mediaData) {
      errors.push('media file is invalid');
    } else {
      updates.media_data = mediaData;
    }

    if (!mediaMimeType) {
      errors.push('media MIME type is required');
    } else {
      updates.media_mime_type = mediaMimeType;
    }

    if (resolvedMediaType && mediaMimeType) {
      const mime = mediaMimeType.toLowerCase();

      if (resolvedMediaType === HERO_MEDIA_TYPES.IMAGE && !mime.startsWith('image/')) {
        errors.push('media_type image requires an image/* file');
      }

      if (resolvedMediaType === HERO_MEDIA_TYPES.VIDEO && !mime.startsWith('video/')) {
        errors.push('media_type video requires a video/* file');
      }
    }

    if (mediaData && resolvedMediaType === HERO_MEDIA_TYPES.IMAGE) {
      if (mediaData.length > IMAGE_MAX_BYTES) {
        errors.push('image media exceeds 2MB limit');
      }
    }

    if (mediaData && resolvedMediaType === HERO_MEDIA_TYPES.VIDEO) {
      if (mediaData.length > VIDEO_MAX_BYTES) {
        errors.push('video media exceeds 20MB limit');
      }
    }
  } else if (mediaTypeProvided) {
    const resolvedMediaType = normalizeMediaType(explicitMediaType, null);

    if (!resolvedMediaType) {
      errors.push('media_type is required and must be image or video');
    } else if (
      existingSlide
      && existingSlide.media_type
      && cleanText(existingSlide.media_type) !== resolvedMediaType
    ) {
      errors.push('media_type can only be changed when a new media file is uploaded');
    } else {
      updates.media_type = resolvedMediaType;
    }
  }

  return { updates, errors };
}

async function ensureHeroSlidesTable(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${HERO_SLIDE_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NULL,
      description TEXT NULL,
      badge_text VARCHAR(120) NULL,
      media_type ENUM('image', 'video') NOT NULL,
      media_data LONGBLOB NOT NULL,
      media_mime_type VARCHAR(120) NOT NULL,
      cta_text VARCHAR(255) NULL,
      cta_link TEXT NULL,
      secondary_cta_text VARCHAR(255) NULL,
      secondary_cta_link TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      position INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_hero_slides_active_position (is_active, position),
      INDEX idx_hero_slides_position (position)
    )`
  );

  for (const column of HERO_OPTIONAL_COLUMNS) {
    const [rows] = await connection.query(
      `SHOW COLUMNS FROM ${HERO_SLIDE_TABLE} LIKE ?`,
      [column.name]
    );

    if (rows.length === 0) {
      await connection.query(
        `ALTER TABLE ${HERO_SLIDE_TABLE}
         ADD COLUMN ${column.name} ${column.definition}`
      );
    }
  }

  await connection.query(
    `ALTER TABLE ${HERO_SLIDE_TABLE}
     MODIFY COLUMN title VARCHAR(255) NULL,
     MODIFY COLUMN media_type ENUM('image', 'video') NULL,
     MODIFY COLUMN media_data LONGBLOB NULL,
     MODIFY COLUMN media_mime_type VARCHAR(120) NULL,
     MODIFY COLUMN position INT NULL DEFAULT NULL`
  );
}

function mapHeroSlideRow(row) {
  return {
    id: Number(row.id),
    title: cleanText(row.title),
    subtitle: toNullableText(row.subtitle),
    description: toNullableText(row.description),
    badge_text: toNullableText(row.badge_text),
    media_type: cleanText(row.media_type),
    media_mime_type: toNullableText(row.media_mime_type),
    cta_text: toNullableText(row.cta_text),
    cta_link: toNullableText(row.cta_link),
    secondary_cta_text: toNullableText(row.secondary_cta_text),
    secondary_cta_link: toNullableText(row.secondary_cta_link),
    is_active: Number(row.is_active) === 1,
    position: Number(row.position),
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  };
}

async function getHeroSlideById(id, connection = db) {
  const [rows] = await connection.query(
    `SELECT id,
            title,
            subtitle,
            description,
            badge_text,
            media_type,
            media_mime_type,
            cta_text,
            cta_link,
            secondary_cta_text,
            secondary_cta_link,
            is_active,
            position,
            created_at,
            updated_at
     FROM ${HERO_SLIDE_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ? mapHeroSlideRow(rows[0]) : null;
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
    'description',
    'badge_text',
    'media_type',
    'media_data',
    'media_mime_type',
    'cta_text',
    'cta_link',
    'secondary_cta_text',
    'secondary_cta_link',
    'is_active',
    'position',
  ];

  const values = [
    payload.title,
    payload.subtitle,
    payload.description,
    payload.badge_text,
    payload.media_type,
    payload.media_data,
    payload.media_mime_type,
    payload.cta_text,
    payload.cta_link,
    payload.secondary_cta_text,
    payload.secondary_cta_link,
    payload.is_active ? 1 : 0,
    resolvedPosition,
  ];

  const placeholders = columns.map(() => '?').join(', ');

  const [insertResult] = await connection.query(
    `INSERT INTO ${HERO_SLIDE_TABLE} (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );

  const createdId = Number(insertResult.insertId);
  return getHeroSlideById(createdId, connection);
}

async function updateHeroSlideById(id, updates, connection = db) {
  const allowedColumns = [
    'title',
    'subtitle',
    'description',
    'badge_text',
    'media_type',
    'media_data',
    'media_mime_type',
    'cta_text',
    'cta_link',
    'secondary_cta_text',
    'secondary_cta_link',
    'is_active',
    'position',
  ];

  const columnsToUpdate = allowedColumns.filter((column) =>
    Object.prototype.hasOwnProperty.call(updates || {}, column)
  );

  if (columnsToUpdate.length === 0) {
    return getHeroSlideById(id, connection);
  }

  const setClause = columnsToUpdate.map((column) => `${column} = ?`).join(', ');
  const values = columnsToUpdate.map((column) => updates[column]);

  const [result] = await connection.query(
    `UPDATE ${HERO_SLIDE_TABLE}
     SET ${setClause}
     WHERE id = ?
     LIMIT 1`,
    [...values, id]
  );

  if (Number(result.affectedRows) <= 0) {
    return getHeroSlideById(id, connection);
  }

  return getHeroSlideById(id, connection);
}

async function getHeroSlides(options = {}, connection = db) {
  const activeOnly = Boolean(options.activeOnly);

  const [rows] = activeOnly
    ? await connection.query(
      `SELECT id,
              title,
              subtitle,
              description,
              badge_text,
              media_type,
              media_mime_type,
              cta_text,
              cta_link,
              secondary_cta_text,
              secondary_cta_link,
              is_active,
              position,
              created_at,
              updated_at
       FROM ${HERO_SLIDE_TABLE}
       WHERE is_active = 1
         AND media_type IN ('image', 'video')
         AND media_data IS NOT NULL
         AND media_mime_type IS NOT NULL
       ORDER BY position ASC, id ASC`
    )
    : await connection.query(
      `SELECT id,
              title,
              subtitle,
              description,
              badge_text,
              media_type,
              media_mime_type,
              cta_text,
              cta_link,
              secondary_cta_text,
              secondary_cta_link,
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
  normalizeHeroSlideUpdatePayload,
  ensureHeroSlidesTable,
  createHeroSlide,
  getHeroSlideById,
  updateHeroSlideById,
  getHeroSlides,
  getHeroSlideMediaById,
  deleteHeroSlideById,
};
