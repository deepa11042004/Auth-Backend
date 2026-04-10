const express = require('express');

const contactQueryController = require('../controllers/contactQueryController');

const router = express.Router();

/**
 * @openapi
 * /api/contact-queries:
 *   post:
 *     tags: [Contact Queries]
 *     summary: Submit contact query form
 *   get:
 *     tags: [Contact Queries]
 *     summary: Get all contact queries for admin panel
 */
router.post('/contact-queries', contactQueryController.createContactQuery);
router.get('/contact-queries', contactQueryController.getContactQueries);
router.delete('/contact-queries/:id', contactQueryController.deleteContactQuery);

module.exports = router;
