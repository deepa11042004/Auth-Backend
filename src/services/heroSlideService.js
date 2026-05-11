const HeroSlide = require('../models/HeroSlide');
const {
  uploadHeroSlideMedia,
  deleteHeroSlideMedia,
} = require('./s3StorageService');

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

  if (!file || !Buffer.isBuffer(file.buffer)) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'A media file is required to create a hero slide.',
      },
    };
  }

  // Upload to S3 first — use a temporary key without slide id, will be correct on re-upload
  const uploadResult = await uploadHeroSlideMedia({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
    slideId: 'new',
  });

  normalizedPayload.media_path = uploadResult.s3Path;
  normalizedPayload.media_file_name = file.originalname || null;
  normalizedPayload.media_storage = 's3';

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

async function updateAdminHeroSlide(rawId, payload, file) {
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

  const existingSlide = await HeroSlide.getHeroSlideById(id);

  if (!existingSlide) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Hero slide not found',
      },
    };
  }

  const { updates, errors } = HeroSlide.normalizeHeroSlideUpdatePayload(payload || {}, {
    file: file || null,
    existingSlide,
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

  // Upload new media to S3 when a file was provided
  if (file && Buffer.isBuffer(file.buffer)) {
    const uploadResult = await uploadHeroSlideMedia({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      slideId: id,
    });

    const previousS3Path = existingSlide.media_path || null;

    updates.media_path = uploadResult.s3Path;
    updates.media_file_name = file.originalname || null;
    updates.media_storage = 's3';

    const updatedSlide = await HeroSlide.updateHeroSlideById(id, updates);

    if (!updatedSlide) {
      return {
        status: 404,
        body: { success: false, message: 'Hero slide not found' },
      };
    }

    // Best-effort cleanup of the previous S3 object
    if (previousS3Path) {
      deleteHeroSlideMedia({ s3Path: previousS3Path }).catch(() => {});
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Hero slide updated successfully',
        data: attachMediaUrl(updatedSlide),
      },
    };
  }

  if (Object.keys(updates).length === 0) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'No changes were provided for hero slide update.',
      },
    };
  }

  const updatedSlide = await HeroSlide.updateHeroSlideById(id, updates);

  if (!updatedSlide) {
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
      message: 'Hero slide updated successfully',
      data: attachMediaUrl(updatedSlide),
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

  const hasS3 = Boolean(media.media_path);
  const hasBlob = Buffer.isBuffer(media.media_data) && media.media_data.length > 0;

  if (!hasS3 && !hasBlob) {
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
  updateAdminHeroSlide,
  listPublicHeroSlides,
  listAdminHeroSlides,
  fetchHeroSlideMedia,
  deleteAdminHeroSlide,
};
