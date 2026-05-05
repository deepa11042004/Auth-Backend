const express = require('express');

const footerNewsController = require('../controllers/footerNewsController');
const authAdmin = require('../middleware/authAdmin');

const router = express.Router();

/**
 * @openapi
 * /api/admin/footer-news:
 *   post:
 *     tags: [Footer News]
 *     summary: Create a footer news item (admin)
 *   get:
 *     tags: [Footer News]
 *     summary: List footer news items for admin management
 * /api/footer-news:
 *   get:
 *     tags: [Footer News]
 *     summary: List active footer news items (public)
 */
router.post('/admin/footer-news', authAdmin, footerNewsController.createAdminFooterNews);
router.get('/admin/footer-news', authAdmin, footerNewsController.getAdminFooterNews);
router.put('/admin/footer-news/:id', authAdmin, footerNewsController.updateAdminFooterNews);
router.delete('/admin/footer-news/:id', authAdmin, footerNewsController.deleteAdminFooterNews);

router.get('/footer-news', footerNewsController.getPublicFooterNews);

module.exports = router;
