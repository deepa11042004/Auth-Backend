const institutionalRegistrationService = require('../services/institutionalRegistrationService');

async function createInstitutionalRegistration(req, res, next) {
  try {
    const result = await institutionalRegistrationService.registerInstitution(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getInstitutionalRegistrations(req, res, next) {
  try {
    const result = await institutionalRegistrationService.listInstitutionalRegistrations();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createInstitutionalRegistration,
  getInstitutionalRegistrations,
};
