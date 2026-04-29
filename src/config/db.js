const mysql = require('mysql2/promise');

const basePoolConfig = {
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
};

const bsercDB = mysql.createPool({
  ...basePoolConfig,
  host: process.env.BSERC_DB_HOST || process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.BSERC_DB_PORT || process.env.DB_PORT) || 3306,
  user: process.env.BSERC_DB_USER || process.env.DB_USER || 'root',
  password: process.env.BSERC_DB_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.BSERC_DB_NAME || process.env.DB_NAME || 'bserc_core_db',
});

// Backward-compatible default export for existing auth modules.
module.exports = bsercDB;
module.exports.bsercDB = bsercDB;
