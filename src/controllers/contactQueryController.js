const contactQueryService = require('../services/contactQueryService');

async function createContactQuery(req, res, next) {
  try {
    const result = await contactQueryService.submitContactQuery(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getContactQueries(req, res, next) {
  try {
    const result = await contactQueryService.listContactQueries();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function deleteContactQuery(req, res, next) {
  try {
    const result = await contactQueryService.removeContactQuery(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function markContactQuerySolved(req, res, next) {
  try {
    const result = await contactQueryService.markContactQuerySolved(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function markContactQueryPending(req, res, next) {
  try {
    const result = await contactQueryService.markContactQueryPending(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createContactQuery,
  getContactQueries,
  deleteContactQuery,
  markContactQuerySolved,
  markContactQueryPending,
};
