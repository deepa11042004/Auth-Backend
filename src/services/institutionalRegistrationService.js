const InstitutionalRegistration = require('../models/InstitutionalRegistration');

async function registerInstitution(payload) {
  await InstitutionalRegistration.ensureInstitutionalRegistrationTable();

  const {
    payload: normalizedPayload,
    errors,
  } = InstitutionalRegistration.normalizeInstitutionalRegistrationPayload(payload || {});

  if (errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        message: errors.join('. '),
        errors,
      },
    };
  }

  const registration = await InstitutionalRegistration.createInstitutionalRegistration(
    normalizedPayload
  );

  return {
    status: 201,
    body: {
      success: true,
      message: 'Institutional registration submitted successfully',
      data: registration,
    },
  };
}

async function listInstitutionalRegistrations() {
  await InstitutionalRegistration.ensureInstitutionalRegistrationTable();

  const registrations = await InstitutionalRegistration.getInstitutionalRegistrations();

  return {
    status: 200,
    body: {
      success: true,
      data: registrations,
    },
  };
}

module.exports = {
  registerInstitution,
  listInstitutionalRegistrations,
};
