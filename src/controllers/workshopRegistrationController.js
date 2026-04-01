const workshopRegistrationService = require('../services/workshopRegistrationService');

async function registerForWorkshop(req, res, next) {
  try {
    const result = await workshopRegistrationService.registerForWorkshop(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function createPaymentOrder(req, res, next) {
  try {
    const result = await workshopRegistrationService.createPaymentOrder(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function verifyPaymentAndRegister(req, res, next) {
  try {
    const result = await workshopRegistrationService.verifyPaymentAndRegister(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createPaymentOrder,
  verifyPaymentAndRegister,
  registerForWorkshop,
};
