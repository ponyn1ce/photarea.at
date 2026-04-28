const db = require('../database/init');
const { normalizeRoleLevel, effectiveRoleLevel, effectiveRoleText } = require('../utils/role');

function loadUser(req, res, next) {
  if (req.user && typeof req.user.role_level !== 'undefined') return next();
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });

  db.get('SELECT id, role_level, role, email, login, first_name, last_name FROM users WHERE id = ?', [req.userId], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!row) return res.status(401).json({ message: 'Unauthorized' });

    req.user = {
      id: row.id,
      role_level: effectiveRoleLevel(row),
      role: effectiveRoleText(row),
      email: row.email,
      login: row.login,
      first_name: row.first_name,
      last_name: row.last_name,
    };
    next();
  });
}

function requireRole(minRoleLevel) {
  const min = normalizeRoleLevel(minRoleLevel);

  return [
    loadUser,
    (req, res, next) => {
      const current = normalizeRoleLevel(req.user?.role_level);
      if (current < min) return res.status(403).json({ message: 'Forbidden' });
      next();
    },
  ];
}

module.exports = {
  loadUser,
  requireRole,
};
