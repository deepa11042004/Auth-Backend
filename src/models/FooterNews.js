const db = require('../config/db');

const FOOTER_NEWS_TABLE = 'footer_news_updates';
const MAX_TITLE_LENGTH = 255;
const MAX_LINK_LENGTH = 2000;

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

function hasOwnField(input, fieldNames) {
  if (!input || typeof input !== 'object') {
    return false;
  }

  return fieldNames.some((fieldName) =>
    Object.prototype.hasOwnProperty.call(input, fieldName)
  );
}

function parseOptionalPosition(value) {
  if (value === undefined || value === null || value === '') {
    return {
      position: null,
      error: null,
    };
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 1) {
    return {
      position: null,
      error: 'position must be a positive integer',
    };
  }

  return {
    position: Math.round(numeric),
    error: null,
  };
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

function isValidLink(value) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return false;
  }

  if (
    cleaned.startsWith('/')
    || cleaned.startsWith('#')
    || cleaned.startsWith('mailto:')
    || cleaned.startsWith('tel:')
  ) {
    return true;
  }

  try {
    const parsed = new URL(cleaned);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeFooterNewsPayload(input = {}) {
  const title = cleanText(input.title || input.heading);
  const link = cleanText(input.link || input.href || input.url);
  const { position, error: positionError } = parseOptionalPosition(input.position);

  const payload = {
    title,
    link,
    position,
    is_active: toBoolean(input.is_active ?? input.isActive, true),
  };

  const errors = [];

  if (!payload.title) {
    errors.push('title is required');
  } else if (payload.title.length > MAX_TITLE_LENGTH) {
    errors.push(`title cannot exceed ${MAX_TITLE_LENGTH} characters`);
  }

  if (!payload.link) {
    errors.push('link is required');
  } else if (payload.link.length > MAX_LINK_LENGTH) {
    errors.push(`link cannot exceed ${MAX_LINK_LENGTH} characters`);
  } else if (!isValidLink(payload.link)) {
    errors.push('link must be a valid URL or site-relative path');
  }

  if (positionError) {
    errors.push(positionError);
  }

  return { payload, errors };
}

function normalizeFooterNewsUpdatePayload(input = {}, options = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const existingItem =
    options.existingItem && typeof options.existingItem === 'object'
      ? options.existingItem
      : null;

  const updates = {};
  const errors = [];

  if (hasOwnField(source, ['title', 'heading'])) {
    const title = cleanText(source.title ?? source.heading);

    if (!title) {
      errors.push('title is required');
    } else if (title.length > MAX_TITLE_LENGTH) {
      errors.push(`title cannot exceed ${MAX_TITLE_LENGTH} characters`);
    } else {
      updates.title = title;
    }
  }

  if (hasOwnField(source, ['link', 'href', 'url'])) {
    const link = cleanText(source.link ?? source.href ?? source.url);

    if (!link) {
      errors.push('link is required');
    } else if (link.length > MAX_LINK_LENGTH) {
      errors.push(`link cannot exceed ${MAX_LINK_LENGTH} characters`);
    } else if (!isValidLink(link)) {
      errors.push('link must be a valid URL or site-relative path');
    } else {
      updates.link = link;
    }
  }

  if (hasOwnField(source, ['position'])) {
    const { position, error } = parseOptionalPosition(source.position);

    if (error) {
      errors.push(error);
    } else {
      updates.position = position;
    }
  }

  if (hasOwnField(source, ['is_active', 'isActive'])) {
    const fallback = existingItem ? Boolean(existingItem.is_active) : true;
    updates.is_active = toBoolean(source.is_active ?? source.isActive, fallback);
  }

  return { updates, errors };
}

async function ensureFooterNewsTable(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${FOOTER_NEWS_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      link TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      position INT NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_footer_news_active_position (is_active, position),
      INDEX idx_footer_news_position (position)
    )`
  );

  await connection.query(
    `ALTER TABLE ${FOOTER_NEWS_TABLE}
     MODIFY COLUMN position INT NULL DEFAULT NULL`
  );
}

function mapFooterNewsRow(row) {
  const numericPosition = row.position === null || row.position === undefined
    ? null
    : Number(row.position);

  return {
    id: Number(row.id),
    title: cleanText(row.title),
    link: cleanText(row.link),
    is_active: Number(row.is_active) === 1,
    position: Number.isInteger(numericPosition) && numericPosition > 0 ? numericPosition : null,
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  };
}

async function getFooterNewsById(id, connection = db) {
  const [rows] = await connection.query(
    `SELECT id,
            title,
            link,
            is_active,
            position,
            created_at,
            updated_at
     FROM ${FOOTER_NEWS_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ? mapFooterNewsRow(rows[0]) : null;
}

async function getNextPosition(connection = db) {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
     FROM ${FOOTER_NEWS_TABLE}
     WHERE position IS NOT NULL`
  );

  return Number(rows?.[0]?.next_position || 1);
}

async function createFooterNews(payload, connection = db) {
  const resolvedPosition = payload.position === null
    ? await getNextPosition(connection)
    : payload.position;

  const [insertResult] = await connection.query(
    `INSERT INTO ${FOOTER_NEWS_TABLE} (title, link, is_active, position)
     VALUES (?, ?, ?, ?)`,
    [
      payload.title,
      payload.link,
      payload.is_active ? 1 : 0,
      resolvedPosition,
    ]
  );

  return getFooterNewsById(Number(insertResult.insertId), connection);
}

async function updateFooterNewsById(id, updates, connection = db) {
  const allowedColumns = ['title', 'link', 'is_active', 'position'];

  const columnsToUpdate = allowedColumns.filter((column) =>
    Object.prototype.hasOwnProperty.call(updates || {}, column)
  );

  if (columnsToUpdate.length === 0) {
    return getFooterNewsById(id, connection);
  }

  const setClause = columnsToUpdate.map((column) => `${column} = ?`).join(', ');
  const values = columnsToUpdate.map((column) => {
    if (column === 'is_active') {
      return updates[column] ? 1 : 0;
    }

    return updates[column];
  });

  const [result] = await connection.query(
    `UPDATE ${FOOTER_NEWS_TABLE}
     SET ${setClause}
     WHERE id = ?
     LIMIT 1`,
    [...values, id]
  );

  if (Number(result.affectedRows) <= 0) {
    return getFooterNewsById(id, connection);
  }

  return getFooterNewsById(id, connection);
}

async function getFooterNewsList(options = {}, connection = db) {
  const activeOnly = Boolean(options.activeOnly);

  const [rows] = activeOnly
    ? await connection.query(
      `SELECT id,
              title,
              link,
              is_active,
              position,
              created_at,
              updated_at
       FROM ${FOOTER_NEWS_TABLE}
       WHERE is_active = 1
       ORDER BY
         CASE WHEN position IS NULL THEN 1 ELSE 0 END,
         position ASC,
         id DESC`
    )
    : await connection.query(
      `SELECT id,
              title,
              link,
              is_active,
              position,
              created_at,
              updated_at
       FROM ${FOOTER_NEWS_TABLE}
       ORDER BY
         CASE WHEN position IS NULL THEN 1 ELSE 0 END,
         position ASC,
         id DESC`
    );

  return rows.map(mapFooterNewsRow);
}

async function deleteFooterNewsById(id, connection = db) {
  const [result] = await connection.query(
    `DELETE FROM ${FOOTER_NEWS_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return Number(result.affectedRows) > 0;
}

module.exports = {
  FOOTER_NEWS_TABLE,
  normalizeFooterNewsPayload,
  normalizeFooterNewsUpdatePayload,
  ensureFooterNewsTable,
  createFooterNews,
  getFooterNewsById,
  updateFooterNewsById,
  getFooterNewsList,
  deleteFooterNewsById,
};
