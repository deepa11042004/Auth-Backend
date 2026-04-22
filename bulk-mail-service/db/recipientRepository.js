const env = require('../config/env');
const { query } = require('./mysql');
const { HttpError } = require('../utils/httpError');
const { validateIdentifier, quoteIdentifier } = require('../utils/validators');

function ensureRecipientDbConfigured() {
  if (!env.recipientDbName) {
    throw new HttpError(
      500,
      'BULK_MAIL_SOURCE_DB_NAME (or RECIPIENT_DB_NAME / DB_NAME) is required for recipient lookup'
    );
  }
}

async function getColumnsByTable(tableName) {
  ensureRecipientDbConfigured();

  const safeTable = validateIdentifier(tableName, 'tableName');
  const [rows] = await query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `,
    [env.recipientDbName, safeTable]
  );

  if (!rows.length) {
    throw new HttpError(400, `Table '${safeTable}' does not exist`);
  }

  return rows.map((row) => row.COLUMN_NAME);
}

async function assertColumnsExist(tableName, columns) {
  const safeTable = validateIdentifier(tableName, 'tableName');
  const normalizedColumns = columns.map((columnName) =>
    validateIdentifier(columnName, 'columnName')
  );

  const existingColumns = new Set(await getColumnsByTable(safeTable));
  const missingColumns = normalizedColumns.filter(
    (columnName) => !existingColumns.has(columnName)
  );

  if (missingColumns.length) {
    throw new HttpError(400, `Columns not found in '${safeTable}': ${missingColumns.join(', ')}`);
  }

  return normalizedColumns;
}

async function fetchRecipientsInChunks(options) {
  ensureRecipientDbConfigured();

  const tableName = validateIdentifier(options.tableName, 'tableName');
  const columns = Array.from(
    new Set(
      (options.columns || []).map((columnName) =>
        validateIdentifier(columnName, 'columnName')
      )
    )
  );

  if (!columns.length) {
    throw new HttpError(400, 'At least one column is required');
  }

  await assertColumnsExist(tableName, columns);

  const chunkSize = Number(options.chunkSize) > 0 ? Number(options.chunkSize) : 500;
  const onChunk = options.onChunk;

  if (typeof onChunk !== 'function') {
    throw new HttpError(500, 'onChunk callback is required');
  }

  let offset = 0;
  let totalRows = 0;

  while (true) {
    const tableRef = `${quoteIdentifier(env.recipientDbName)}.${quoteIdentifier(tableName)}`;

    const [rows] = await query(
      `
        SELECT ${columns.map((columnName) => quoteIdentifier(columnName)).join(', ')}
        FROM ${tableRef}
        LIMIT ? OFFSET ?
      `,
      [chunkSize, offset]
    );

    if (!rows.length) {
      break;
    }

    await onChunk(rows);

    totalRows += rows.length;
    offset += rows.length;

    if (rows.length < chunkSize) {
      break;
    }
  }

  return { totalRows };
}

module.exports = {
  getColumnsByTable,
  assertColumnsExist,
  fetchRecipientsInChunks,
};
