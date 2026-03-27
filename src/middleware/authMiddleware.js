const { verifyToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (!token || scheme?.toLowerCase() !== 'bearer') {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
