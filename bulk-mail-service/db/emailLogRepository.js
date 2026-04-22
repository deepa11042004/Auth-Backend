const { query } = require('./mysql');
const env = require('../config/env');
const { HttpError } = require('../utils/httpError');
const { quoteIdentifier } = require('../utils/validators');

function getEmailLogsTableRef() {
  if (!env.bulkMailDbName) {
    throw new HttpError(
      500,
      'BULK_MAIL_DB_NAME (or BULK_DB_NAME / DB_NAME) is required for email logs'
    );
  }

  return `${quoteIdentifier(env.bulkMailDbName)}.${quoteIdentifier('email_logs')}`;
}

async function insertEmailLog(payload) {
  const tableRef = getEmailLogsTableRef();

  const [result] = await query(
    `
      INSERT INTO ${tableRef} (email, subject, status, error)
      VALUES (?, ?, ?, ?)
    `,
    [payload.email, payload.subject, payload.status, payload.error || null]
  );

  return result.insertId;
}

async function getEmailLogs(filters) {
  const tableRef = getEmailLogsTableRef();

  const whereClauses = [];
  const params = [];

  if (filters.status) {
    whereClauses.push('status = ?');
    params.push(filters.status);
  }

  if (filters.email) {
    whereClauses.push('email = ?');
    params.push(filters.email);
  }

  const limit = Number(filters.limit) > 0 ? Number(filters.limit) : 100;
  params.push(limit);

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await query(
    `
      SELECT id, email, subject, status, error, created_at
      FROM ${tableRef}
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    params
  );

  return rows;
}

module.exports = {
  insertEmailLog,
  getEmailLogs,
};
