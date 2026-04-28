const tokenService = require('../services/token.service');
const db = require('../database/init');
const { effectiveRoleLevel, effectiveRoleText } = require('../utils/role');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const cookieToken = req.cookies && req.cookies.auth_token ? String(req.cookies.auth_token) : null;
  const token = bearerToken || cookieToken;
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const payload = tokenService.verifyToken(token);
    req.userId = payload.id;

    // Load user role once for all protected routes
    db.get('SELECT id, role_level, role FROM users WHERE id = ?', [req.userId], (err, row) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (!row) return res.status(401).json({ message: 'Unauthorized' });
      req.user = {
        id: row.id,
        role_level: effectiveRoleLevel(row),
        role: effectiveRoleText(row),
      };
      next();
    });
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
