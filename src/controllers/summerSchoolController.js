const summerSchoolService = require('../services/summerSchoolService');

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

module.exports = {
  createStudentRegistration,
  getStudentRegistrations,
};