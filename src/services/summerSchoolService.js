const StudentRegistration = require('../models/StudentRegistration');

async function registerStudent(payload) {
  await StudentRegistration.ensureStudentRegistrationTable();

  const {
    payload: normalizedPayload,
    errors,
  } = StudentRegistration.normalizeStudentRegistrationPayload(payload || {});

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

  const registration = await StudentRegistration.createStudentRegistration(
    normalizedPayload
  );

  return {
    status: 200,
    body: {
      success: true,
      message: 'Student registration submitted successfully',
      data: registration,
    },
  };
}

async function listStudentRegistrations() {
  await StudentRegistration.ensureStudentRegistrationTable();
  const registrations = await StudentRegistration.getStudentRegistrations();

  return {
    status: 200,
    body: {
      success: true,
      data: registrations,
    },
  };
}

module.exports = {
  registerStudent,
  listStudentRegistrations,
};