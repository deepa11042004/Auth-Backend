const workshopListService = require('../services/workshopListService');
const { processImageToWebp } = require('../utils/imageProcessing');

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
  createWorkshop,
  getWorkshopThumbnail,
  getWorkshopCertificate,
};
