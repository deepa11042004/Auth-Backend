const userDashboardService = require('../services/userDashboardService');

async function getProfile(req, res) {
  const response = await userDashboardService.getUserProfile(req.user?.id);
  return res.status(response.status).json(response.body);
}

async function updateProfile(req, res) {
  const response = await userDashboardService.updateUserProfile(req.user?.id, req.body || {});
  return res.status(response.status).json(response.body);
}

async function changePassword(req, res) {
  const response = await userDashboardService.changeUserPassword(req.user?.id, req.body || {});
  return res.status(response.status).json(response.body);
}

async function getWorkshops(req, res) {
  const response = await userDashboardService.listEnrolledWorkshops(req.user?.id);
  return res.status(response.status).json(response.body);
}

async function getCertificates(req, res) {
  const response = await userDashboardService.getCertificates(req.user?.id);
  return res.status(response.status).json(response.body);
}

async function getWishlist(req, res) {
  const response = await userDashboardService.getWishlist(req.user?.id);
  return res.status(response.status).json(response.body);
}

async function addWishlist(req, res) {
  const response = await userDashboardService.addWishlistItem(
    req.user?.id,
    req.body?.workshop_id
  );

  return res.status(response.status).json(response.body);
}

async function removeWishlist(req, res) {
  const response = await userDashboardService.removeWishlistItem(
    req.user?.id,
    req.params?.workshopId
  );

  return res.status(response.status).json(response.body);
}

async function getProgress(req, res) {
  const response = await userDashboardService.getProgressOverview(req.user?.id);
  return res.status(response.status).json(response.body);
}

async function getAttendance(req, res) {
  const response = await userDashboardService.getAttendance(req.user?.id);
  return res.status(response.status).json(response.body);
}

async function getDownloads(req, res) {
  const response = await userDashboardService.getDownloads(req.user?.id);
  return res.status(response.status).json(response.body);
}

async function getSettings(req, res) {
  const response = await userDashboardService.getSettings(req.user?.id);
  return res.status(response.status).json(response.body);
}

async function updateSettings(req, res) {
  const response = await userDashboardService.updateSettings(req.user?.id, req.body || {});
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
