const HeroSlide = require('../models/HeroSlide');

function parseHeroSlideId(rawId) {
  const parsed = Number.parseInt(String(rawId || ''), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function attachMediaUrl(slide) {
  return {
    ...slide,
    media_url: `/api/hero-slides/${slide.id}/media`,
  };
}

async function createAdminHeroSlide(payload, file) {
  await HeroSlide.ensureHeroSlidesTable();

  const {
    payload: normalizedPayload,
    errors,
  } = HeroSlide.normalizeHeroSlidePayload(payload || {}, { file: file || null });

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

  const createdSlide = await HeroSlide.createHeroSlide(normalizedPayload);

  return {
    status: 201,
    body: {
      success: true,
      message: 'Hero slide created successfully',
      data: createdSlide ? attachMediaUrl(createdSlide) : null,
    },
  };
}

async function listPublicHeroSlides() {
  await HeroSlide.ensureHeroSlidesTable();

  const slides = await HeroSlide.getHeroSlides({ activeOnly: true });

  return {
    status: 200,
    body: {
      success: true,
      data: slides.map(attachMediaUrl),
    },
  };
}

async function listAdminHeroSlides() {
  await HeroSlide.ensureHeroSlidesTable();

  const slides = await HeroSlide.getHeroSlides({ activeOnly: false });

  return {
    status: 200,
    body: {
      success: true,
      data: slides.map(attachMediaUrl),
    },
  };
}

async function fetchHeroSlideMedia(rawId, options = {}) {
  await HeroSlide.ensureHeroSlidesTable();

  const activeOnly = options.activeOnly !== false;
  const id = parseHeroSlideId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid hero slide id',
      },
      media: null,
    };
  }

  const media = await HeroSlide.getHeroSlideMediaById(id);

  if (!media) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Hero slide not found',
      },
      media: null,
    };
  }

  if (activeOnly && !media.is_active) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Hero slide not found',
      },
      media: null,
    };
  }

  if (!media.media_data || media.media_data.length <= 0) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Hero media not found',
      },
      media: null,
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Hero media fetched successfully',
    },
    media,
  };
}

async function deleteAdminHeroSlide(rawId) {
  await HeroSlide.ensureHeroSlidesTable();

  const id = parseHeroSlideId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid hero slide id',
      },
    };
  }

  const wasDeleted = await HeroSlide.deleteHeroSlideById(id);

  if (!wasDeleted) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Hero slide not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Hero slide deleted successfully',
    },
  };
}

module.exports = {
  createAdminHeroSlide,
  listPublicHeroSlides,
  listAdminHeroSlides,
  fetchHeroSlideMedia,
  deleteAdminHeroSlide,
};
