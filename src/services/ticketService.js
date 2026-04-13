const db = require('../config/db');
const notificationService = require('./notificationService');

const SUPPORT_TICKETS_TABLE = 'support_tickets';
const TICKET_MESSAGES_TABLE = 'ticket_messages';
const USERS_TABLE = 'users';
const WORKSHOP_LIST_TABLE = 'workshop_list';

const TICKET_CATEGORIES = [
  'registration_issue',
  'payment_issue',
  'workshop_info',
  'reschedule_request',
  'certificate_issue',
  'other',
];

const TICKET_PRIORITIES = ['low', 'medium', 'high'];
const TICKET_STATUSES = ['open', 'in-progress', 'resolved', 'closed'];
const REOPENABLE_STATUSES = new Set(['resolved', 'closed']);

const TICKET_CATEGORY_SET = new Set(TICKET_CATEGORIES);
const TICKET_PRIORITY_SET = new Set(TICKET_PRIORITIES);
const TICKET_STATUS_SET = new Set(TICKET_STATUSES);

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

function toPositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
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

function normalizeTicketCategory(value) {
  const normalized = cleanText(value).toLowerCase();

  if (TICKET_CATEGORY_SET.has(normalized)) {
    return normalized;
  }

  const aliases = {
    registration: 'registration_issue',
    payment: 'payment_issue',
    workshop_access: 'workshop_info',
    offline_details: 'workshop_info',
    certificate: 'certificate_issue',
    refund_policy: 'other',
  };

  return aliases[normalized] || 'other';
}

function normalizeTicketPriority(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) {
    return 'medium';
  }

  return TICKET_PRIORITY_SET.has(normalized) ? normalized : 'medium';
}

function normalizeTicketStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) {
    return 'open';
  }

  return TICKET_STATUS_SET.has(normalized) ? normalized : 'open';
}

function buildAttachmentUrl(file) {
  if (!file || !file.filename) {
    return null;
  }

  return `/uploads/tickets/${file.filename}`;
}

function mapTicketRow(row) {
  return {
    id: Number(row.id),
    user_id: toPositiveInt(row.user_id),
    user_name: toNullableText(row.user_name),
    user_email: toNullableText(row.user_email),
    workshop_id: toPositiveInt(row.workshop_id),
    workshop_title: toNullableText(row.workshop_title),
    subject: cleanText(row.subject),
    description: cleanText(row.description),
    category: normalizeTicketCategory(row.category),
    priority: normalizeTicketPriority(row.priority),
    status: normalizeTicketStatus(row.status),
    attachment_url: toNullableText(row.attachment_url),
    created_at: formatDateTime(row.created_at),
    updated_at: formatDateTime(row.updated_at),
    last_message: toNullableText(row.last_message),
  };
}

function mapTicketMessageRow(row) {
  return {
    id: Number(row.id),
    ticket_id: Number(row.ticket_id),
    sender_id: toPositiveInt(row.sender_id),
    sender_role: cleanText(row.sender_role).toLowerCase() === 'admin' ? 'admin' : 'user',
    message: typeof row.message === 'string' ? row.message : '',
    attachment_url: toNullableText(row.attachment_url),
    created_at: formatDateTime(row.created_at),
  };
}

async function ensureTicketTables(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${SUPPORT_TICKETS_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      workshop_id INT NULL,
      subject VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      category ENUM('registration_issue','payment_issue','workshop_info','reschedule_request','certificate_issue','other') NOT NULL DEFAULT 'other',
      priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
      status ENUM('open','in-progress','resolved','closed') NOT NULL DEFAULT 'open',
      attachment_url VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_support_tickets_user_id (user_id),
      INDEX idx_support_tickets_workshop_id (workshop_id),
      INDEX idx_support_tickets_status (status),
      INDEX idx_support_tickets_category (category),
      INDEX idx_support_tickets_updated_at (updated_at)
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${TICKET_MESSAGES_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      sender_id INT NOT NULL,
      sender_role ENUM('user','admin') NOT NULL,
      message TEXT NOT NULL,
      attachment_url VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ticket_messages_ticket_id (ticket_id),
      INDEX idx_ticket_messages_created_at (created_at)
    )`
  );
}

async function resolveWorkshopTitle(workshopId, connection = db) {
  if (!workshopId) {
    return null;
  }

  try {
    const [rows] = await connection.query(
      `SELECT id, title
       FROM ${WORKSHOP_LIST_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [workshopId]
    );

    if (!rows[0]) {
      return null;
    }

    return cleanText(rows[0].title) || `Workshop ${workshopId}`;
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return `Workshop ${workshopId}`;
    }

    throw err;
  }
}

async function fetchTicketRowById(ticketId, options = {}, connection = db) {
  const whereClauses = ['t.id = ?'];
  const params = [ticketId];

  if (typeof options.userId === 'number') {
    whereClauses.push('t.user_id = ?');
    params.push(options.userId);
  }

  const [rows] = await connection.query(
    `SELECT
      t.*,
      u.full_name AS user_name,
      u.email AS user_email,
      wl.title AS workshop_title
     FROM ${SUPPORT_TICKETS_TABLE} t
     LEFT JOIN ${USERS_TABLE} u ON u.id = t.user_id
     LEFT JOIN ${WORKSHOP_LIST_TABLE} wl ON wl.id = t.workshop_id
     WHERE ${whereClauses.join(' AND ')}
     LIMIT 1`,
    params
  );

  return rows[0] ? mapTicketRow(rows[0]) : null;
}

async function fetchTicketMessages(ticketId, connection = db) {
  const [rows] = await connection.query(
    `SELECT id, ticket_id, sender_id, sender_role, message, attachment_url, created_at
     FROM ${TICKET_MESSAGES_TABLE}
     WHERE ticket_id = ?
     ORDER BY created_at ASC, id ASC`,
    [ticketId]
  );

  return rows.map(mapTicketMessageRow);
}

async function buildTicketDetails(ticketId, options = {}, connection = db) {
  const ticket = await fetchTicketRowById(ticketId, options, connection);
  if (!ticket) {
    return null;
  }

  const messages = await fetchTicketMessages(ticketId, connection);

  return {
    ...ticket,
    messages,
  };
}

async function createTicket(userId, payload = {}, attachmentFile) {
  await ensureTicketTables();

  const resolvedUserId = toPositiveInt(userId);
  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  const subject = cleanText(payload.subject);
  const description = cleanText(payload.description);
  const category = normalizeTicketCategory(payload.category);
  const priority = normalizeTicketPriority(payload.priority);
  const workshopId = toPositiveInt(payload.workshopId || payload.workshop_id);
  const attachmentUrl = buildAttachmentUrl(attachmentFile);

  const errors = [];

  if (!subject) {
    errors.push('Subject is required.');
  }

  if (subject.length > 200) {
    errors.push('Subject must be 200 characters or less.');
  }

  if (!description) {
    errors.push('Description is required.');
  }

  if (description.length > 5000) {
    errors.push('Description must be 5000 characters or less.');
  }

  if (errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        message: errors.join(' '),
      },
    };
  }

  let workshopTitle = null;

  if (workshopId) {
    workshopTitle = await resolveWorkshopTitle(workshopId);
    if (!workshopTitle) {
      return {
        status: 400,
        body: {
          success: false,
          message: 'Selected workshop not found.',
        },
      };
    }
  }

  const [insertResult] = await db.query(
    `INSERT INTO ${SUPPORT_TICKETS_TABLE}
      (user_id, workshop_id, subject, description, category, priority, status, attachment_url)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      resolvedUserId,
      workshopId,
      subject,
      description,
      category,
      priority,
      attachmentUrl,
    ]
  );

  const createdTicketId = Number(insertResult.insertId);

  await db.query(
    `INSERT INTO ${TICKET_MESSAGES_TABLE}
      (ticket_id, sender_id, sender_role, message, attachment_url)
     VALUES (?, ?, 'user', ?, ?)`,
    [
      createdTicketId,
      resolvedUserId,
      description,
      attachmentUrl,
    ]
  );

  const ticket = await buildTicketDetails(createdTicketId, { userId: resolvedUserId });

  if (ticket) {
    void notificationService.sendTicketCreatedEmail({
      userEmail: ticket.user_email,
      ticketId: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      workshopTitle,
    });
  }

  return {
    status: 201,
    body: {
      success: true,
      message: 'Ticket created successfully.',
      data: ticket,
    },
  };
}

async function listUserTickets(userId) {
  await ensureTicketTables();

  const resolvedUserId = toPositiveInt(userId);
  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  const [rows] = await db.query(
    `SELECT
      t.*,
      wl.title AS workshop_title,
      (
        SELECT tm.message
        FROM ${TICKET_MESSAGES_TABLE} tm
        WHERE tm.ticket_id = t.id
        ORDER BY tm.created_at DESC, tm.id DESC
        LIMIT 1
      ) AS last_message
     FROM ${SUPPORT_TICKETS_TABLE} t
     LEFT JOIN ${WORKSHOP_LIST_TABLE} wl ON wl.id = t.workshop_id
     WHERE t.user_id = ?
     ORDER BY t.updated_at DESC, t.id DESC`,
    [resolvedUserId]
  );

  return {
    status: 200,
    body: {
      success: true,
      data: rows.map(mapTicketRow),
    },
  };
}

async function getTicketDetailsForUser(userId, ticketId) {
  await ensureTicketTables();

  const resolvedUserId = toPositiveInt(userId);
  const resolvedTicketId = toPositiveInt(ticketId);

  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  if (!resolvedTicketId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid ticket id.',
      },
    };
  }

  const ticket = await buildTicketDetails(resolvedTicketId, { userId: resolvedUserId });

  if (!ticket) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Ticket not found.',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      data: ticket,
    },
  };
}

async function addTicketMessageByUser(userId, ticketId, payload = {}, attachmentFile) {
  await ensureTicketTables();

  const resolvedUserId = toPositiveInt(userId);
  const resolvedTicketId = toPositiveInt(ticketId);

  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  if (!resolvedTicketId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid ticket id.',
      },
    };
  }

  const ticket = await fetchTicketRowById(resolvedTicketId, { userId: resolvedUserId });

  if (!ticket) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Ticket not found.',
      },
    };
  }

  const message = cleanText(payload.message);
  const attachmentUrl = buildAttachmentUrl(attachmentFile);

  if (!message && !attachmentUrl) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Message or attachment is required.',
      },
    };
  }

  await db.query(
    `INSERT INTO ${TICKET_MESSAGES_TABLE}
      (ticket_id, sender_id, sender_role, message, attachment_url)
     VALUES (?, ?, 'user', ?, ?)`,
    [resolvedTicketId, resolvedUserId, message || 'Attachment uploaded', attachmentUrl]
  );

  const nextStatus = REOPENABLE_STATUSES.has(ticket.status) ? 'open' : ticket.status;

  await db.query(
    `UPDATE ${SUPPORT_TICKETS_TABLE}
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextStatus, resolvedTicketId]
  );

  const details = await buildTicketDetails(resolvedTicketId, { userId: resolvedUserId });

  return {
    status: 201,
    body: {
      success: true,
      message: 'Message sent successfully.',
      data: details,
    },
  };
}

async function listAdminTickets(filters = {}) {
  await ensureTicketTables();

  const whereClauses = [];
  const params = [];

  const status = cleanText(filters.status).toLowerCase();
  if (status && TICKET_STATUS_SET.has(status)) {
    whereClauses.push('t.status = ?');
    params.push(status);
  }

  const category = cleanText(filters.category).toLowerCase();
  if (category && TICKET_CATEGORY_SET.has(category)) {
    whereClauses.push('t.category = ?');
    params.push(category);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT
      t.*,
      u.full_name AS user_name,
      u.email AS user_email,
      wl.title AS workshop_title,
      (
        SELECT tm.message
        FROM ${TICKET_MESSAGES_TABLE} tm
        WHERE tm.ticket_id = t.id
        ORDER BY tm.created_at DESC, tm.id DESC
        LIMIT 1
      ) AS last_message
     FROM ${SUPPORT_TICKETS_TABLE} t
     LEFT JOIN ${USERS_TABLE} u ON u.id = t.user_id
     LEFT JOIN ${WORKSHOP_LIST_TABLE} wl ON wl.id = t.workshop_id
     ${whereSql}
     ORDER BY t.updated_at DESC, t.id DESC`,
    params
  );

  return {
    status: 200,
    body: {
      success: true,
      data: rows.map(mapTicketRow),
    },
  };
}

async function getTicketDetailsForAdmin(ticketId) {
  await ensureTicketTables();

  const resolvedTicketId = toPositiveInt(ticketId);

  if (!resolvedTicketId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid ticket id.',
      },
    };
  }

  const ticket = await buildTicketDetails(resolvedTicketId);

  if (!ticket) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Ticket not found.',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      data: ticket,
    },
  };
}

async function updateTicketStatusByAdmin(ticketId, nextStatus) {
  await ensureTicketTables();

  const resolvedTicketId = toPositiveInt(ticketId);

  if (!resolvedTicketId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid ticket id.',
      },
    };
  }

  const normalizedStatus = cleanText(nextStatus).toLowerCase();
  if (!TICKET_STATUS_SET.has(normalizedStatus)) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid ticket status.',
      },
    };
  }

  const currentTicket = await fetchTicketRowById(resolvedTicketId);

  if (!currentTicket) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Ticket not found.',
      },
    };
  }

  await db.query(
    `UPDATE ${SUPPORT_TICKETS_TABLE}
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [normalizedStatus, resolvedTicketId]
  );

  const details = await buildTicketDetails(resolvedTicketId);

  if (details) {
    void notificationService.sendStatusChangedEmail({
      userEmail: details.user_email,
      ticketId: details.id,
      status: details.status,
    });
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Ticket status updated successfully.',
      data: details,
    },
  };
}

async function addTicketReplyByAdmin(adminId, ticketId, payload = {}, attachmentFile) {
  await ensureTicketTables();

  const resolvedAdminId = toPositiveInt(adminId);
  const resolvedTicketId = toPositiveInt(ticketId);

  if (!resolvedAdminId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized admin session.',
      },
    };
  }

  if (!resolvedTicketId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid ticket id.',
      },
    };
  }

  const ticket = await fetchTicketRowById(resolvedTicketId);

  if (!ticket) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Ticket not found.',
      },
    };
  }

  const message = cleanText(payload.message);
  const attachmentUrl = buildAttachmentUrl(attachmentFile);

  if (!message && !attachmentUrl) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Reply message or attachment is required.',
      },
    };
  }

  await db.query(
    `INSERT INTO ${TICKET_MESSAGES_TABLE}
      (ticket_id, sender_id, sender_role, message, attachment_url)
     VALUES (?, ?, 'admin', ?, ?)`,
    [resolvedTicketId, resolvedAdminId, message || 'Attachment uploaded', attachmentUrl]
  );

  const nextStatus = ticket.status === 'open' ? 'in-progress' : ticket.status;

  await db.query(
    `UPDATE ${SUPPORT_TICKETS_TABLE}
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextStatus, resolvedTicketId]
  );

  const details = await buildTicketDetails(resolvedTicketId);

  if (details) {
    void notificationService.sendAdminReplyEmail({
      userEmail: details.user_email,
      ticketId: details.id,
    });
  }

  return {
    status: 201,
    body: {
      success: true,
      message: 'Reply sent successfully.',
      data: details,
    },
  };
}

module.exports = {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  ensureTicketTables,
  createTicket,
  listUserTickets,
  getTicketDetailsForUser,
  addTicketMessageByUser,
  listAdminTickets,
  getTicketDetailsForAdmin,
  updateTicketStatusByAdmin,
  addTicketReplyByAdmin,
};
