const { query } = require('./mysql');
const env = require('../config/env');
const { HttpError } = require('../utils/httpError');
const { quoteIdentifier } = require('../utils/validators');

function getTemplatesTableRef() {
  if (!env.bulkMailDbName) {
    throw new HttpError(
      500,
      'BULK_MAIL_DB_NAME (or BULK_DB_NAME / DB_NAME) is required for templates'
    );
  }

  return `${quoteIdentifier(env.bulkMailDbName)}.${quoteIdentifier('templates')}`;
}

async function getTemplateById(templateId) {
  const tableRef = getTemplatesTableRef();

  const [rows] = await query(
    `
      SELECT id, name, subject, html, created_at
      FROM ${tableRef}
      WHERE id = ?
      LIMIT 1
    `,
    [templateId]
  );

  return rows[0] || null;
}

module.exports = {
  getTemplateById,
};
