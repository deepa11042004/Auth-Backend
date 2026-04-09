const ContactQuery = require('../models/ContactQuery');

async function submitContactQuery(payload) {
  await ContactQuery.ensureContactQueryTable();

  const {
    payload: normalizedPayload,
    errors,
  } = ContactQuery.normalizeContactQueryPayload(payload || {});

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

  const contactQuery = await ContactQuery.createContactQuery(normalizedPayload);

  return {
    status: 201,
    body: {
      success: true,
      message: 'Contact query submitted successfully',
      data: contactQuery,
    },
  };
}

async function listContactQueries() {
  await ContactQuery.ensureContactQueryTable();

  const queries = await ContactQuery.getContactQueries();

  return {
    status: 200,
    body: {
      success: true,
      data: queries,
    },
  };
}

module.exports = {
  submitContactQuery,
  listContactQueries,
};
