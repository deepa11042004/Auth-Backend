const heroSlideService = require('../services/heroSlideService');

async function createAdminHeroSlide(req, res, next) {
  try {
    const result = await heroSlideService.createAdminHeroSlide(req.body || {}, req.file || null);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getPublicHeroSlides(req, res, next) {
  try {
    const result = await heroSlideService.listPublicHeroSlides();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getAdminHeroSlides(req, res, next) {
  try {
    const result = await heroSlideService.listAdminHeroSlides();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getHeroSlideMedia(req, res, next) {
  try {
    const result = await heroSlideService.fetchHeroSlideMedia(req.params.id, { activeOnly: true });

    if (!result.media) {
      return res.status(result.status).json(result.body);
    }

    const mimeType = result.media.media_mime_type || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(result.media.media_data.length));
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');

    return res.status(200).send(result.media.media_data);
  } catch (err) {
    return next(err);
  }
}

async function deleteAdminHeroSlide(req, res, next) {
  try {
    const result = await heroSlideService.deleteAdminHeroSlide(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createAdminHeroSlide,
  getPublicHeroSlides,
  getAdminHeroSlides,
  getHeroSlideMedia,
  deleteAdminHeroSlide,
};
