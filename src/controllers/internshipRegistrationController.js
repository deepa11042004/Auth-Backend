const internshipRegistrationService = require('../services/internshipRegistrationService');

async function createPaymentOrder(req, res, next) {
  try {
    const result = await internshipRegistrationService.createPaymentOrder(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function verifyPaymentAndRegister(req, res, next) {
  try {
    const payload = { ...(req.body || {}) };
    const uploadedPhoto = req.internshipPhoto || req.file;

    if (uploadedPhoto?.buffer) {
      payload.passport_photo = uploadedPhoto.buffer;
      payload.passport_photo_mime_type = uploadedPhoto.mimetype;
      payload.passport_photo_file_name = uploadedPhoto.originalname;
    }

    const result = await internshipRegistrationService.verifyPaymentAndRegister(payload);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function registerWithoutPayment(req, res, next) {
  try {
    const payload = { ...(req.body || {}) };
    const uploadedPhoto = req.internshipPhoto || req.file;

    if (uploadedPhoto?.buffer) {
      payload.passport_photo = uploadedPhoto.buffer;
      payload.passport_photo_mime_type = uploadedPhoto.mimetype;
      payload.passport_photo_file_name = uploadedPhoto.originalname;
    }

    const result = await internshipRegistrationService.registerWithoutPayment(payload);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getInternshipRegistrations(req, res, next) {
  try {
    const result = await internshipRegistrationService.getInternshipRegistrations();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getInternshipFeeSettings(req, res, next) {
  try {
    const result = await internshipRegistrationService.getInternshipFeeSettings();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function updateInternshipFeeSettings(req, res, next) {
  try {
    const result = await internshipRegistrationService.updateInternshipFeeSettings(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createPaymentOrder,
  verifyPaymentAndRegister,
  registerWithoutPayment,
  getInternshipRegistrations,
  getInternshipFeeSettings,
  updateInternshipFeeSettings,
};
