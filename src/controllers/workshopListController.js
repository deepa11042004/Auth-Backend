const workshopListService = require('../services/workshopListService');

async function createWorkshop(req, res) {
  try {
    const result = await workshopListService.createWorkshop(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Workshop list create error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create workshop',
    });
  }
}

module.exports = {
  createWorkshop,
};
