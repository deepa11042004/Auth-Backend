const userDashboardService = require('../services/userDashboardService');

function parseAuthUserId(req) {
  const parsed = Number.parseInt(
    String(req.user?.userId ?? req.user?.id ?? ''),
    10
  );

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function getProfile(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.getUserProfile(userId);
  return res.status(response.status).json(response.body);
}

async function updateProfile(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.updateUserProfile(userId, req.body || {});
  return res.status(response.status).json(response.body);
}

async function changePassword(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.changeUserPassword(userId, req.body || {});
  return res.status(response.status).json(response.body);
}

async function getWorkshops(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.listEnrolledWorkshops(userId);
  return res.status(response.status).json(response.body);
}

async function getCertificates(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.getCertificates(userId);
  return res.status(response.status).json(response.body);
}

async function getWishlist(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.getWishlist(userId);
  return res.status(response.status).json(response.body);
}

async function addWishlist(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.addWishlistItem(
    userId,
    req.body?.workshop_id
  );

  return res.status(response.status).json(response.body);
}

async function removeWishlist(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.removeWishlistItem(
    userId,
    req.params?.workshopId
  );

  return res.status(response.status).json(response.body);
}

async function getProgress(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.getProgressOverview(userId);
  return res.status(response.status).json(response.body);
}

async function getAttendance(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.getAttendance(userId);
  return res.status(response.status).json(response.body);
}

async function getDownloads(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.getDownloads(userId);
  return res.status(response.status).json(response.body);
}

async function getSettings(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.getSettings(userId);
  return res.status(response.status).json(response.body);
}

async function updateSettings(req, res) {
  const userId = parseAuthUserId(req);
  const response = await userDashboardService.updateSettings(userId, req.body || {});
  return res.status(response.status).json(response.body);
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getWorkshops,
  getCertificates,
  getWishlist,
  addWishlist,
  removeWishlist,
  getProgress,
  getAttendance,
  getDownloads,
  getSettings,
  updateSettings,
};
