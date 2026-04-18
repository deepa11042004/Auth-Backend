const workshopListService = require('../services/workshopListService');
const { processImageToWebp } = require('../utils/imageProcessing');

async function getWorkshopList(req, res) {
  try {
    const workshops = await workshopListService.getWorkshopList();
    return res.status(200).json(workshops);
  } catch (err) {
    console.error('Workshop list fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workshop list',
    });
  }
}

async function getAllParticipants(req, res) {
  try {
    const result = await workshopListService.getAllParticipants();
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Workshop participants list fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch participants list',
    });
  }
}

async function createWorkshop(req, res) {
  try {
    const payload = { ...(req.body || {}) };
    const thumbnailFile = req.files?.thumbnail?.[0];
    const certificateFile = req.files?.certificate?.[0] || req.files?.certificate_file?.[0];

    const [thumbnailBuffer, certificateBuffer] = await Promise.all([
      thumbnailFile ? processImageToWebp(thumbnailFile.buffer) : null,
      certificateFile ? processImageToWebp(certificateFile.buffer) : null,
    ]);

    if (thumbnailBuffer) {
      payload.thumbnail = thumbnailBuffer;
    }

    if (certificateBuffer) {
      payload.certificate_file = certificateBuffer;
    }

    const result = await workshopListService.createWorkshop(payload);
    return res.status(result.status).json(result.body);
  } catch (err) {
    if (err && err.code === 'IMAGE_PROCESSING_FAILED') {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    console.error('Workshop list create error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create workshop',
    });
  }
}

async function getWorkshopById(req, res) {
  try {
    const result = await workshopListService.getWorkshopById(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Workshop fetch by id error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workshop',
    });
  }
}

async function updateWorkshop(req, res) {
  try {
    const payload = { ...(req.body || {}) };
    const thumbnailFile = req.files?.thumbnail?.[0];
    const certificateFile = req.files?.certificate?.[0] || req.files?.certificate_file?.[0];

    const [thumbnailBuffer, certificateBuffer] = await Promise.all([
      thumbnailFile ? processImageToWebp(thumbnailFile.buffer) : null,
      certificateFile ? processImageToWebp(certificateFile.buffer) : null,
    ]);

    if (thumbnailBuffer) {
      payload.thumbnail = thumbnailBuffer;
    }

    if (certificateBuffer) {
      payload.certificate_file = certificateBuffer;
    }

    const result = await workshopListService.updateWorkshop(req.params.id, payload);
    return res.status(result.status).json(result.body);
  } catch (err) {
    if (err && err.code === 'IMAGE_PROCESSING_FAILED') {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    console.error('Workshop update error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update workshop',
    });
  }
}

async function deleteWorkshop(req, res) {
  try {
    const result = await workshopListService.deleteWorkshop(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Workshop delete error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete workshop',
    });
  }
}

async function deleteWorkshopParticipant(req, res) {
  try {
    const result = await workshopListService.deleteWorkshopParticipant(
      req.params.participantId
    );
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Workshop participant delete error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete workshop participant',
    });
  }
}

async function getWorkshopParticipants(req, res) {
  try {
    const result = await workshopListService.getWorkshopParticipants(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Workshop participants fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workshop participants',
    });
  }
}

async function getWorkshopThumbnail(req, res) {
  try {
    const result = await workshopListService.getWorkshopImageById(req.params.id, 'thumbnail');

    if (result.image) {
      res.set('Content-Type', 'image/webp');
      return res.status(200).send(result.image);
    }

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Workshop thumbnail fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workshop thumbnail',
    });
  }
}

async function getWorkshopCertificate(req, res) {
  try {
    const result = await workshopListService.getWorkshopImageById(
      req.params.id,
      'certificate_file'
    );

    if (result.image) {
      res.set('Content-Type', 'image/webp');
      return res.status(200).send(result.image);
    }

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Workshop certificate fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workshop certificate',
    });
  }
}

module.exports = {
  getWorkshopList,
  getAllParticipants,
  getWorkshopById,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  deleteWorkshopParticipant,
  getWorkshopParticipants,
  getWorkshopThumbnail,
  getWorkshopCertificate,
};
