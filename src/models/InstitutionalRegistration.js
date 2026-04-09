const db = require('../config/db');

const INSTITUTIONAL_REGISTRATION_TABLE = 'institutional_registrations';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[0-9\s-]{10,15}$/;
const PIN_CODE_REGEX = /^[0-9A-Za-z\s-]{4,12}$/;

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

function normalizeInstitutionalRegistrationPayload(input = {}) {
  const payload = {
    institute_name: cleanText(
      input.institute_name || input.instituteName || input.school_name || input.schoolName
    ),
    board: cleanText(input.board),
    city: cleanText(input.city),
    state: cleanText(input.state),
    pin_code: toNullableText(input.pin_code || input.pinCode),
    contact_name: cleanText(input.contact_name || input.contactName),
    designation: cleanText(input.designation),
    email: normalizeEmail(input.email),
    phone: cleanText(input.phone),
    student_count: cleanText(input.student_count || input.studentCount),
    head_name: cleanText(input.head_name || input.headName),
    head_email: normalizeEmail(input.head_email || input.headEmail),
    head_phone: toNullableText(input.head_phone || input.headPhone),
    message: toNullableText(input.message),
  };

  const errors = [];

  if (!payload.institute_name) {
    errors.push('institute_name is required');
  }

  if (!payload.board) {
    errors.push('board is required');
  }

  if (!payload.city) {
    errors.push('city is required');
  }

  if (!payload.state) {
    errors.push('state is required');
  }

  if (!payload.contact_name) {
    errors.push('contact_name is required');
  }

  if (!payload.designation) {
    errors.push('designation is required');
  }

  if (!payload.email) {
    errors.push('email is required');
  } else if (!EMAIL_REGEX.test(payload.email)) {
    errors.push('Invalid email format');
  }

  if (!payload.phone) {
    errors.push('phone is required');
  } else if (!PHONE_REGEX.test(payload.phone)) {
    errors.push('Invalid phone format');
  }

  if (!payload.student_count) {
    errors.push('student_count is required');
  }

  if (!payload.head_name) {
    errors.push('head_name is required');
  }

  if (!payload.head_email) {
    errors.push('head_email is required');
  } else if (!EMAIL_REGEX.test(payload.head_email)) {
    errors.push('Invalid head_email format');
  }

  if (payload.head_phone && !PHONE_REGEX.test(payload.head_phone)) {
    errors.push('Invalid head_phone format');
  }

  if (payload.pin_code && !PIN_CODE_REGEX.test(payload.pin_code)) {
    errors.push('Invalid pin_code format');
  }

  if (payload.message && payload.message.length > 500) {
    errors.push('message cannot exceed 500 characters');
  }

  return { payload, errors };
}

async function ensureInstitutionalRegistrationTable(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${INSTITUTIONAL_REGISTRATION_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      institute_name VARCHAR(255) NOT NULL,
      board VARCHAR(120) NOT NULL,
      city VARCHAR(120) NOT NULL,
      state VARCHAR(120) NOT NULL,
      pin_code VARCHAR(20) NULL,
      contact_name VARCHAR(255) NOT NULL,
      designation VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      student_count VARCHAR(80) NOT NULL,
      head_name VARCHAR(255) NOT NULL,
      head_email VARCHAR(255) NOT NULL,
      head_phone VARCHAR(30) NULL,
      message TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_institutional_registrations_created_at (created_at),
      INDEX idx_institutional_registrations_email (email),
      INDEX idx_institutional_registrations_head_email (head_email)
    )`
  );
}

function mapInstitutionalRegistrationRow(row) {
  return {
    id: Number(row.id),
    institute_name: cleanText(row.institute_name),
    board: cleanText(row.board),
    city: cleanText(row.city),
    state: cleanText(row.state),
    pin_code: cleanText(row.pin_code) || null,
    contact_name: cleanText(row.contact_name),
    designation: cleanText(row.designation),
    email: cleanText(row.email),
    phone: cleanText(row.phone),
    student_count: cleanText(row.student_count),
    head_name: cleanText(row.head_name),
    head_email: cleanText(row.head_email),
    head_phone: cleanText(row.head_phone) || null,
    message: cleanText(row.message) || null,
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  };
}

async function createInstitutionalRegistration(payload, connection = db) {
  const columns = [
    'institute_name',
    'board',
    'city',
    'state',
    'pin_code',
    'contact_name',
    'designation',
    'email',
    'phone',
    'student_count',
    'head_name',
    'head_email',
    'head_phone',
    'message',
  ];

  const values = [
    payload.institute_name,
    payload.board,
    payload.city,
    payload.state,
    payload.pin_code,
    payload.contact_name,
    payload.designation,
    payload.email,
    payload.phone,
    payload.student_count,
    payload.head_name,
    payload.head_email,
    payload.head_phone,
    payload.message,
  ];

  const placeholders = columns.map(() => '?').join(', ');

  const [insertResult] = await connection.query(
    `INSERT INTO ${INSTITUTIONAL_REGISTRATION_TABLE} (${columns.join(', ')})
     VALUES (${placeholders})`,
    values
  );

  const createdId = Number(insertResult.insertId);
  const [rows] = await connection.query(
    `SELECT *
     FROM ${INSTITUTIONAL_REGISTRATION_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [createdId]
  );

  return rows[0] ? mapInstitutionalRegistrationRow(rows[0]) : null;
}

async function getInstitutionalRegistrations(connection = db) {
  const [rows] = await connection.query(
    `SELECT *
     FROM ${INSTITUTIONAL_REGISTRATION_TABLE}
     ORDER BY created_at DESC, id DESC`
  );

  return rows.map(mapInstitutionalRegistrationRow);
}

module.exports = {
  INSTITUTIONAL_REGISTRATION_TABLE,
  normalizeInstitutionalRegistrationPayload,
  ensureInstitutionalRegistrationTable,
  createInstitutionalRegistration,
  getInstitutionalRegistrations,
};
