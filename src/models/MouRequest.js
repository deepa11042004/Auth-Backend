const db = require('../config/db');

const MOU_REQUEST_TABLE = 'mou_requests';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function toNullableInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric);
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

function normalizeMouRequestPayload(input = {}, options = {}) {
  const file = options.file && typeof options.file === 'object' ? options.file : null;
  const supportingDocumentBuffer = file && Buffer.isBuffer(file.buffer) ? file.buffer : null;

  const payload = {
    institution_name: cleanText(input.institution_name || input.institutionName),
    registered_address: cleanText(input.registered_address || input.registeredAddress),
    signatory_name: cleanText(input.signatory_name || input.signatoryName),
    designation: cleanText(input.designation),
    official_email: normalizeEmail(input.official_email || input.officialEmail),
    official_phone: cleanText(input.official_phone || input.officialPhone),
    alternative_email: normalizeEmail(input.alternative_email || input.alternativeEmail),
    proposal_purpose: cleanText(input.proposal_purpose || input.proposalPurpose),
    submission_type:
      cleanText(input.submission_type || input.submissionType || 'mou_proposal')
      || 'mou_proposal',
    supporting_document_name: toNullableText(file ? file.originalname : null),
    supporting_document_data: supportingDocumentBuffer,
    supporting_document_mime: toNullableText(file ? file.mimetype : null),
    supporting_document_size: toNullableInteger(file ? file.size : null),
  };

  const errors = [];

  if (!payload.institution_name) {
    errors.push('institution_name is required');
  }

  if (!payload.registered_address) {
    errors.push('registered_address is required');
  }

  if (!payload.signatory_name) {
    errors.push('signatory_name is required');
  }

  if (!payload.designation) {
    errors.push('designation is required');
  }

  if (!payload.official_email) {
    errors.push('official_email is required');
  } else if (!EMAIL_REGEX.test(payload.official_email)) {
    errors.push('Invalid official_email format');
  }

  if (!payload.alternative_email) {
    errors.push('alternative_email is required');
  } else if (!EMAIL_REGEX.test(payload.alternative_email)) {
    errors.push('Invalid alternative_email format');
  }

  if (!payload.official_phone) {
    errors.push('official_phone is required');
  }

  if (!payload.proposal_purpose) {
    errors.push('proposal_purpose is required');
  } else {
    if (payload.proposal_purpose.length < 100) {
      errors.push('proposal_purpose must be at least 100 characters long');
    }

    if (payload.proposal_purpose.length > 2000) {
      errors.push('proposal_purpose cannot exceed 2000 characters');
    }
  }

  if (payload.submission_type.length > 80) {
    errors.push('submission_type cannot exceed 80 characters');
  }

  return { payload, errors };
}

async function ensureMouRequestTable(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${MOU_REQUEST_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      institution_name VARCHAR(255) NOT NULL,
      registered_address TEXT NOT NULL,
      signatory_name VARCHAR(255) NOT NULL,
      designation VARCHAR(150) NOT NULL,
      official_email VARCHAR(255) NOT NULL,
      official_phone VARCHAR(40) NOT NULL,
      alternative_email VARCHAR(255) NOT NULL,
      proposal_purpose TEXT NOT NULL,
      submission_type VARCHAR(80) NOT NULL DEFAULT 'mou_proposal',
      supporting_document_name VARCHAR(255) NULL,
      supporting_document_data LONGBLOB NULL,
      supporting_document_mime VARCHAR(120) NULL,
      supporting_document_size INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mou_requests_created_at (created_at),
      INDEX idx_mou_requests_official_email (official_email),
      INDEX idx_mou_requests_submission_type (submission_type)
    )`
  );

  const [supportingDocumentDataColumn] = await connection.query(
    `SHOW COLUMNS FROM ${MOU_REQUEST_TABLE} LIKE 'supporting_document_data'`
  );

  if (supportingDocumentDataColumn.length === 0) {
    await connection.query(
      `ALTER TABLE ${MOU_REQUEST_TABLE}
       ADD COLUMN supporting_document_data LONGBLOB NULL AFTER supporting_document_name`
    );
  }
}

function mapMouRequestRow(row) {
  return {
    id: Number(row.id),
    institution_name: cleanText(row.institution_name),
    registered_address: cleanText(row.registered_address),
    signatory_name: cleanText(row.signatory_name),
    designation: cleanText(row.designation),
    official_email: cleanText(row.official_email),
    official_phone: cleanText(row.official_phone),
    alternative_email: cleanText(row.alternative_email) || null,
    proposal_purpose: cleanText(row.proposal_purpose),
    submission_type: cleanText(row.submission_type),
    supporting_document_name: cleanText(row.supporting_document_name) || null,
    supporting_document_mime: cleanText(row.supporting_document_mime) || null,
    supporting_document_size: toNullableInteger(row.supporting_document_size),
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
  };
}

async function createMouRequest(payload, connection = db) {
  const columns = [
    'institution_name',
    'registered_address',
    'signatory_name',
    'designation',
    'official_email',
    'official_phone',
    'alternative_email',
    'proposal_purpose',
    'submission_type',
    'supporting_document_name',
    'supporting_document_data',
    'supporting_document_mime',
    'supporting_document_size',
  ];

  const values = [
    payload.institution_name,
    payload.registered_address,
    payload.signatory_name,
    payload.designation,
    payload.official_email,
    payload.official_phone,
    payload.alternative_email,
    payload.proposal_purpose,
    payload.submission_type,
    payload.supporting_document_name,
    payload.supporting_document_data,
    payload.supporting_document_mime,
    payload.supporting_document_size,
  ];

  const placeholders = columns.map(() => '?').join(', ');

  const [insertResult] = await connection.query(
    `INSERT INTO ${MOU_REQUEST_TABLE} (${columns.join(', ')})
     VALUES (${placeholders})`,
    values
  );

  const createdId = Number(insertResult.insertId);

  const [rows] = await connection.query(
    `SELECT id,
            institution_name,
            registered_address,
            signatory_name,
            designation,
            official_email,
            official_phone,
            alternative_email,
            proposal_purpose,
            submission_type,
            supporting_document_name,
            supporting_document_mime,
            supporting_document_size,
            created_at,
            updated_at
     FROM ${MOU_REQUEST_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [createdId]
  );

  return rows[0] ? mapMouRequestRow(rows[0]) : null;
}

async function getMouRequests(connection = db) {
  const [rows] = await connection.query(
    `SELECT id,
            institution_name,
            registered_address,
            signatory_name,
            designation,
            official_email,
            official_phone,
            alternative_email,
            proposal_purpose,
            submission_type,
            supporting_document_name,
            supporting_document_mime,
            supporting_document_size,
            created_at,
            updated_at
     FROM ${MOU_REQUEST_TABLE}
     ORDER BY created_at DESC, id DESC`
  );

  return rows.map(mapMouRequestRow);
}

async function getMouRequestDocumentById(id, connection = db) {
  const [rows] = await connection.query(
    `SELECT id,
            supporting_document_name,
            supporting_document_mime,
            supporting_document_size,
            supporting_document_data
     FROM ${MOU_REQUEST_TABLE}
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
    supporting_document_name: cleanText(row.supporting_document_name) || null,
    supporting_document_mime: cleanText(row.supporting_document_mime) || null,
    supporting_document_size: toNullableInteger(row.supporting_document_size),
    supporting_document_data: Buffer.isBuffer(row.supporting_document_data)
      ? row.supporting_document_data
      : null,
  };
}

async function deleteMouRequest(id, connection = db) {
  const [result] = await connection.query(
    `DELETE FROM ${MOU_REQUEST_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return Number(result.affectedRows) > 0;
}

module.exports = {
  MOU_REQUEST_TABLE,
  normalizeMouRequestPayload,
  ensureMouRequestTable,
  createMouRequest,
  getMouRequests,
  getMouRequestDocumentById,
  deleteMouRequest,
};