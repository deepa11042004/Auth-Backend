const authMiddleware = require('./authMiddleware');
const requireRole = require('./requireRole');
const roles = require('../constants/roles');

function authAdmin(req, res, next) {
  return authMiddleware(req, res, () =>
    requireRole(roles.ADMIN, roles.SUPER_ADMIN)(req, res, next)
  );
}

module.exports = authAdmin;
