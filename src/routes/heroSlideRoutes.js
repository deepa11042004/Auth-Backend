const express = require('express');

const heroSlideController = require('../controllers/heroSlideController');
const authAdmin = require('../middleware/authAdmin');
const { uploadHeroSlideMedia } = require('../middleware/heroSlideUpload');

const router = express.Router();

/**
 * @openapi
 * /api/admin/hero-slides:
 *   post:
 *     tags: [Hero Slides]
 *     summary: Create a hero slide (admin)
 *   get:
 *     tags: [Hero Slides]
 *     summary: List hero slides for admin management
 * /api/hero-slides:
 *   get:
 *     tags: [Hero Slides]
 *     summary: List active hero slides (public metadata)
 */
router.post('/admin/hero-slides', authAdmin, uploadHeroSlideMedia, heroSlideController.createAdminHeroSlide);
router.get('/admin/hero-slides', authAdmin, heroSlideController.getAdminHeroSlides);
router.put('/admin/hero-slides/:id', authAdmin, uploadHeroSlideMedia, heroSlideController.updateAdminHeroSlide);
router.delete('/admin/hero-slides/:id', authAdmin, heroSlideController.deleteAdminHeroSlide);

router.get('/hero-slides', heroSlideController.getPublicHeroSlides);
router.get('/hero-slides/:id/media', heroSlideController.getHeroSlideMedia);

module.exports = router;
