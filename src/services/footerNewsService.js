const FooterNews = require('../models/FooterNews');

function parseFooterNewsId(rawId) {
  const parsed = Number.parseInt(String(rawId || ''), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function createAdminFooterNews(payload) {
  await FooterNews.ensureFooterNewsTable();

  const {
    payload: normalizedPayload,
    errors,
  } = FooterNews.normalizeFooterNewsPayload(payload || {});

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

  const createdItem = await FooterNews.createFooterNews(normalizedPayload);

  return {
    status: 201,
    body: {
      success: true,
      message: 'Footer news item created successfully',
      data: createdItem,
    },
  };
}

async function updateAdminFooterNews(rawId, payload) {
  await FooterNews.ensureFooterNewsTable();

  const id = parseFooterNewsId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid footer news id',
      },
    };
  }

  const existingItem = await FooterNews.getFooterNewsById(id);

  if (!existingItem) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Footer news item not found',
      },
    };
  }

  const { updates, errors } = FooterNews.normalizeFooterNewsUpdatePayload(payload || {}, {
    existingItem,
  });

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

  if (Object.keys(updates).length === 0) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'No changes were provided for footer news update.',
      },
    };
  }

  const updatedItem = await FooterNews.updateFooterNewsById(id, updates);

  if (!updatedItem) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Footer news item not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Footer news item updated successfully',
      data: updatedItem,
    },
  };
}

async function listPublicFooterNews() {
  await FooterNews.ensureFooterNewsTable();

  const items = await FooterNews.getFooterNewsList({ activeOnly: true });

  return {
    status: 200,
    body: {
      success: true,
      data: items,
    },
  };
}

async function listAdminFooterNews() {
  await FooterNews.ensureFooterNewsTable();

  const items = await FooterNews.getFooterNewsList({ activeOnly: false });

  return {
    status: 200,
    body: {
      success: true,
      data: items,
    },
  };
}

async function deleteAdminFooterNews(rawId) {
  await FooterNews.ensureFooterNewsTable();

  const id = parseFooterNewsId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid footer news id',
      },
    };
  }

  const wasDeleted = await FooterNews.deleteFooterNewsById(id);

  if (!wasDeleted) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Footer news item not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Footer news item deleted successfully',
    },
  };
}

module.exports = {
  createAdminFooterNews,
  updateAdminFooterNews,
  listPublicFooterNews,
  listAdminFooterNews,
  deleteAdminFooterNews,
};
