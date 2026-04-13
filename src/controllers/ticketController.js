const ticketService = require('../services/ticketService');

function parseAuthUserId(req) {
  const parsed = Number.parseInt(String(req.user?.userId ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function createTicket(req, res, next) {
  try {
    const userId = parseAuthUserId(req);
    const result = await ticketService.createTicket(userId, req.body || {}, req.file || null);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getMyTickets(req, res, next) {
  try {
    const userId = parseAuthUserId(req);
    const result = await ticketService.listUserTickets(userId);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getTicketById(req, res, next) {
  try {
    const userId = parseAuthUserId(req);
    const result = await ticketService.getTicketDetailsForUser(userId, req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function postTicketMessage(req, res, next) {
  try {
    const userId = parseAuthUserId(req);
    const result = await ticketService.addTicketMessageByUser(
      userId,
      req.params.id,
      req.body || {},
      req.file || null,
    );

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getAdminTickets(req, res, next) {
  try {
    const result = await ticketService.listAdminTickets({
      status: req.query.status,
      category: req.query.category,
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getAdminTicketById(req, res, next) {
  try {
    const result = await ticketService.getTicketDetailsForAdmin(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function updateAdminTicketStatus(req, res, next) {
  try {
    const result = await ticketService.updateTicketStatusByAdmin(
      req.params.id,
      req.body?.status,
    );

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function postAdminReply(req, res, next) {
  try {
    const adminId = parseAuthUserId(req);
    const result = await ticketService.addTicketReplyByAdmin(
      adminId,
      req.params.id,
      req.body || {},
      req.file || null,
    );

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createTicket,
  getMyTickets,
  getTicketById,
  postTicketMessage,
  getAdminTickets,
  getAdminTicketById,
  updateAdminTicketStatus,
  postAdminReply,
};
