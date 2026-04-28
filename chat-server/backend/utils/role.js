function isSpecial777Admin(role, roleLevel) {
  const r = String(role ?? '');
  const rl = String(roleLevel ?? '');

  // Legacy admin markers (old DB quirks):
  // - some DBs stored swapped values: role='777' and role_level='ad777min'
  // - some DBs stored only one of the markers
  return (
    (r === '777' && rl === 'ad777min') ||
    (r === 'ad777min' && rl === '777') ||
    r === '777' ||
    r === 'ad777min' ||
    rl === '777' ||
    rl === 'ad777min'
  );
}

function parseRoleLevelNumber(roleLevel) {
  const n = Number(roleLevel);
  return Number.isFinite(n) ? n : null;
}

function normalizeRoleLevel(roleLevel) {
  const n = parseRoleLevelNumber(roleLevel);
  if (n === null) return 0;
  if (n <= 0) return 0;
  if (n >= 2) return 2;
  return 1;
}

function effectiveRoleLevel(row) {
  if (!row) return 0;
  if (isSpecial777Admin(row.role, row.role_level)) return 2;
  return normalizeRoleLevel(row.role_level);
}

function effectiveRoleText(row) {
  if (!row) return 'user';
  if (isSpecial777Admin(row.role, row.role_level)) return 'admin';

  const level = normalizeRoleLevel(row.role_level);
  return row.role || (level === 2 ? 'admin' : level === 1 ? 'manager' : 'user');
}

module.exports = {
  isSpecial777Admin,
  normalizeRoleLevel,
  effectiveRoleLevel,
  effectiveRoleText,
};
