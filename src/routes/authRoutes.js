const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/change-password', authMiddleware, authController.changePassword);
router.get('/profile', authMiddleware, authController.profile);
router.get('/admin-only', authMiddleware, requireRole('admin', 'super_admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});
router.get('/instructor-only', authMiddleware, requireRole('instructor', 'super_admin'), (req, res) => {
  res.json({ message: 'Instructor access granted' });
});

module.exports = router;
