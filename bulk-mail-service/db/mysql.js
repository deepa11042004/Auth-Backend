const mysql = require('mysql2/promise');
const env = require('../config/env');

const defaultDatabase = env.dbName || env.recipientDbName || env.bulkMailDbName || undefined;

const pool = mysql.createPool({
  host: env.dbHost,
  user: env.dbUser,
  password: env.dbPassword,
  database: defaultDatabase,
  port: env.dbPort,
  waitForConnections: true,
  connectionLimit: env.dbConnectionLimit,
  queueLimit: 0,
});

function query(sql, params) {
  return pool.query(sql, params);
}

module.exports = {
  pool,
  query,
};
