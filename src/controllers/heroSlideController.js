const heroSlideService = require('../services/heroSlideService');
const { streamHeroSlideMedia } = require('../services/s3StorageService');

async function createAdminHeroSlide(req, res, next) {
  try {
    const result = await heroSlideService.createAdminHeroSlide(req.body || {}, req.file || null);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function updateAdminHeroSlide(req, res, next) {
  try {
    const result = await heroSlideService.updateAdminHeroSlide(
      req.params.id,
      req.body || {},
      req.file || null
    );
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

    const { media } = result;
    const mimeType = media.media_mime_type || 'application/octet-stream';

    const { buffer, contentType } = await streamHeroSlideMedia({ s3Path: media.media_path });

    res.setHeader('Content-Type', contentType || mimeType);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.setHeader('X-Media-Source', 's3');

    return res.status(200).send(buffer);
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
  updateAdminHeroSlide,
  getPublicHeroSlides,
  getAdminHeroSlides,
  getHeroSlideMedia,
  deleteAdminHeroSlide,
};
