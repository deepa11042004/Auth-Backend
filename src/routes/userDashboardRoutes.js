const express = require('express');
const authUser = require('../middleware/authUser');
const userDashboardController = require('../controllers/userDashboardController');

const router = express.Router();

router.use(authUser);

router.get('/profile', userDashboardController.getProfile);
router.put('/profile', userDashboardController.updateProfile);
router.post('/change-password', userDashboardController.changePassword);

router.get('/workshops', userDashboardController.getWorkshops);
router.get('/certificates', userDashboardController.getCertificates);

router.get('/wishlist', userDashboardController.getWishlist);
router.post('/wishlist', userDashboardController.addWishlist);
router.delete('/wishlist/:workshopId', userDashboardController.removeWishlist);

router.get('/progress', userDashboardController.getProgress);
router.get('/attendance', userDashboardController.getAttendance);
router.get('/downloads', userDashboardController.getDownloads);

router.get('/settings', userDashboardController.getSettings);
router.put('/settings', userDashboardController.updateSettings);

module.exports = router;
