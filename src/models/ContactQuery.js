const db = require('../config/db');

const CONTACT_QUERY_TABLE = 'contact_queries';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[0-9\s-]{10,15}$/;

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

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
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

function normalizeContactQueryPayload(input = {}) {
  const payload = {
    full_name: cleanText(
      input.full_name
      || input.fullName
      || input.organization_name
      || input.organizationName
      || input.name
    ),
    email: normalizeEmail(input.email),
    phone: toNullableText(input.phone || input.contact_number || input.contactNumber),
    subject: cleanText(input.subject || input.subject_name || input.subjectName),
    message: cleanText(input.message),
    source_path: toNullableText(input.source_path || input.sourcePath),
  };

  const errors = [];

  if (!payload.full_name) {
    errors.push('full_name is required');
  }

  if (!payload.email) {
    errors.push('email is required');
  } else if (!EMAIL_REGEX.test(payload.email)) {
    errors.push('Invalid email format');
  }

  if (payload.phone && !PHONE_REGEX.test(payload.phone)) {
    errors.push('Invalid phone format');
  }

  if (!payload.subject) {
    errors.push('subject is required');
  } else if (payload.subject.length > 200) {
    errors.push('subject cannot exceed 200 characters');
  }

  if (!payload.message) {
    errors.push('message is required');
  } else if (payload.message.length > 5000) {
    errors.push('message cannot exceed 5000 characters');
  }

  if (payload.source_path && payload.source_path.length > 255) {
    errors.push('source_path cannot exceed 255 characters');
  }

  return { payload, errors };
}

async function ensureContactQueryTable(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${CONTACT_QUERY_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(30) NULL,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      source_path VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_contact_queries_created_at (created_at),
      INDEX idx_contact_queries_email (email)
    )`
  );
}

function mapContactQueryRow(row) {
  const fullName = cleanText(row.full_name);
  const subject = cleanText(row.subject);

  return {
    id: Number(row.id),
    full_name: fullName,
    organization_name: fullName,
    email: cleanText(row.email),
    phone: cleanText(row.phone) || null,
    subject,
    subject_name: subject,
    message: cleanText(row.message),
    source_path: cleanText(row.source_path) || null,
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  };
}

async function createContactQuery(payload, connection = db) {
  const columns = ['full_name', 'email', 'phone', 'subject', 'message', 'source_path'];
  const values = [
    payload.full_name,
    payload.email,
    payload.phone,
    payload.subject,
    payload.message,
    payload.source_path,
  ];

  const placeholders = columns.map(() => '?').join(', ');

  const [insertResult] = await connection.query(
    `INSERT INTO ${CONTACT_QUERY_TABLE} (${columns.join(', ')})
     VALUES (${placeholders})`,
    values
  );

  const createdId = Number(insertResult.insertId);

  const [rows] = await connection.query(
    `SELECT *
     FROM ${CONTACT_QUERY_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [createdId]
  );

  return rows[0] ? mapContactQueryRow(rows[0]) : null;
}

async function getContactQueries(connection = db) {
  const [rows] = await connection.query(
    `SELECT *
     FROM ${CONTACT_QUERY_TABLE}
     ORDER BY created_at DESC, id DESC`
  );

  return rows.map(mapContactQueryRow);
}

module.exports = {
  CONTACT_QUERY_TABLE,
  normalizeContactQueryPayload,
  ensureContactQueryTable,
  createContactQuery,
  getContactQueries,
};
