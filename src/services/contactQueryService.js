const ContactQuery = require('../models/ContactQuery');

function parseContactQueryId(rawId) {
  const parsed = Number.parseInt(String(rawId || ''), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

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

async function removeContactQuery(rawId) {
  await ContactQuery.ensureContactQueryTable();

  const id = parseContactQueryId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid contact query id',
      },
    };
  }

  const wasDeleted = await ContactQuery.deleteContactQuery(id);

  if (!wasDeleted) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Contact query not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Contact query deleted successfully',
    },
  };
}

async function markContactQuerySolved(rawId) {
  await ContactQuery.ensureContactQueryTable();

  const id = parseContactQueryId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid contact query id',
      },
    };
  }

  const updatedQuery = await ContactQuery.markContactQueryAsSolved(id);

  if (!updatedQuery) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Contact query not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Contact query marked as solved',
      data: updatedQuery,
    },
  };
}

async function markContactQueryPending(rawId) {
  await ContactQuery.ensureContactQueryTable();

  const id = parseContactQueryId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid contact query id',
      },
    };
  }

  const updatedQuery = await ContactQuery.markContactQueryAsPending(id);

  if (!updatedQuery) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Contact query not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Contact query marked as pending',
      data: updatedQuery,
    },
  };
}

module.exports = {
  submitContactQuery,
  listContactQueries,
  removeContactQuery,
  markContactQuerySolved,
  markContactQueryPending,
};
