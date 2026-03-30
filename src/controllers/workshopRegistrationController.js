const workshopRegistrationService = require('../services/workshopRegistrationService');

async function registerForWorkshop(req, res, next) {
  try {
    const result = await workshopRegistrationService.registerForWorkshop(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  registerForWorkshop,
};
