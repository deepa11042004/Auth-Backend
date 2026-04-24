const db = require('../config/db');

const REGISTRATION_TABLE = 'registrations';

async function ensureRegistrationTable(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${REGISTRATION_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(80) NOT NULL,
      user_data JSON NOT NULL,
      payment_status VARCHAR(40) DEFAULT 'pending',
      order_id VARCHAR(120) NULL,
      payment_id VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_registrations_type (type),
      INDEX idx_registrations_payment_status (payment_status),
      INDEX idx_registrations_order_id (order_id),
      INDEX idx_registrations_payment_id (payment_id)
    )`
  );
}

async function createRegistration(payload, connection = db) {
  const { type, user_data } = payload;
  
  const [result] = await connection.query(
    `INSERT INTO ${REGISTRATION_TABLE} (type, user_data, payment_status)
     VALUES (?, ?, 'pending')`,
    [type, JSON.stringify(user_data)]
  );

  return {
    id: result.insertId,
    type,
    user_data,
    payment_status: 'pending',
    order_id: null,
    payment_id: null
  };
}

async function updateRegistrationOrder(id, order_id, connection = db) {
  await connection.query(
    `UPDATE ${REGISTRATION_TABLE}
     SET order_id = ?
     WHERE id = ?`,
    [order_id, id]
  );
}

async function updatePaymentStatusByOrder(order_id, payment_status, payment_id = null, connection = db) {
  if (payment_id) {
    await connection.query(
      `UPDATE ${REGISTRATION_TABLE}
       SET payment_status = ?, payment_id = ?
       WHERE order_id = ?`,
      [payment_status, payment_id, order_id]
    );
  } else {
    await connection.query(
      `UPDATE ${REGISTRATION_TABLE}
       SET payment_status = ?
       WHERE order_id = ?`,
      [payment_status, order_id]
    );
  }
}

async function getRegistrationById(id, connection = db) {
  const [rows] = await connection.query(
    `SELECT * FROM ${REGISTRATION_TABLE} WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  REGISTRATION_TABLE,
  ensureRegistrationTable,
  createRegistration,
  updateRegistrationOrder,
  updatePaymentStatusByOrder,
  getRegistrationById
};
