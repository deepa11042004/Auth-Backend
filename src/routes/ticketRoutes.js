const express = require('express');

const ticketController = require('../controllers/ticketController');
const authUser = require('../middleware/authUser');
const authAdmin = require('../middleware/authAdmin');
const { uploadTicketAttachment } = require('../middleware/ticketAttachmentUpload');

const router = express.Router();

// User routes
router.post('/tickets', authUser, uploadTicketAttachment, ticketController.createTicket);
router.get('/tickets/my', authUser, ticketController.getMyTickets);
router.get('/tickets/:id', authUser, ticketController.getTicketById);
router.post('/tickets/:id/message', authUser, uploadTicketAttachment, ticketController.postTicketMessage);

// Admin routes
router.get('/admin/tickets', authAdmin, ticketController.getAdminTickets);
router.get('/admin/tickets/:id', authAdmin, ticketController.getAdminTicketById);
router.patch('/admin/tickets/:id/status', authAdmin, ticketController.updateAdminTicketStatus);
router.post('/admin/tickets/:id/reply', authAdmin, uploadTicketAttachment, ticketController.postAdminReply);

module.exports = router;
