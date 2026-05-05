const footerNewsService = require('../services/footerNewsService');

async function createAdminFooterNews(req, res, next) {
  try {
    const result = await footerNewsService.createAdminFooterNews(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function updateAdminFooterNews(req, res, next) {
  try {
    const result = await footerNewsService.updateAdminFooterNews(req.params.id, req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getPublicFooterNews(req, res, next) {
  try {
    const result = await footerNewsService.listPublicFooterNews();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getAdminFooterNews(req, res, next) {
  try {
    const result = await footerNewsService.listAdminFooterNews();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function deleteAdminFooterNews(req, res, next) {
  try {
    const result = await footerNewsService.deleteAdminFooterNews(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createAdminFooterNews,
  updateAdminFooterNews,
  getPublicFooterNews,
  getAdminFooterNews,
  deleteAdminFooterNews,
};
