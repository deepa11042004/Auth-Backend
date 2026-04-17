const summerSchoolService = require('../services/summerSchoolService');

async function createPaymentOrder(req, res, next) {
  try {
    const result = await summerSchoolService.createPaymentOrder(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function verifyPaymentAndRegister(req, res, next) {
  try {
    const result = await summerSchoolService.verifyPaymentAndRegister(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function logPaymentAttempt(req, res, next) {
  try {
    const result = await summerSchoolService.logPaymentAttempt(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function createStudentRegistration(req, res, next) {
  try {
    const result = await summerSchoolService.registerStudent(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getStudentRegistrations(req, res, next) {
  try {
    const result = await summerSchoolService.listStudentRegistrations();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getSummerSchoolRegistrationSettings(req, res, next) {
  try {
    const result = await summerSchoolService.getSummerSchoolRegistrationSettings();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function updateSummerSchoolRegistrationSettings(req, res, next) {
  try {
    const result = await summerSchoolService.updateSummerSchoolRegistrationSettings(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createPaymentOrder,
  verifyPaymentAndRegister,
  logPaymentAttempt,
  createStudentRegistration,
  getStudentRegistrations,
  getSummerSchoolRegistrationSettings,
  updateSummerSchoolRegistrationSettings,
};