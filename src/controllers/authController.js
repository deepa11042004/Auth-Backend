const authService = require('../services/authService');

async function register(req, res) {
  try {
    const result = await authService.register(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function changePassword(req, res) {
  try {
    const userId = req.user?.userId;
    const { oldPassword, newPassword } = req.body || {};
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await authService.changePassword(userId, oldPassword, newPassword);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function profile(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const result = await authService.getProfile(userId);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  register,
  login,
  changePassword,
  profile,
};
