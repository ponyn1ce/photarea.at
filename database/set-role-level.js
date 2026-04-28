// Run:
//   node database/set-role-level.js --userId=1 --role=2
// role: 0=user, 1=manager, 2=admin

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function parseArgs() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function normalizeRoleLevel(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return 0;
  if (v >= 2) return 2;
  return 1;
}

const args = parseArgs();
const userId = Number(args.userId);
const roleLevel = normalizeRoleLevel(args.role);

if (!Number.isFinite(userId) || userId <= 0) {
  console.error('Missing/invalid --userId');
  process.exit(1);
}
if (roleLevel === null) {
  console.error('Missing/invalid --role (0|1|2)');
  process.exit(1);
}

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`ALTER TABLE users ADD COLUMN role_level INTEGER DEFAULT 0`, () => {
    // ignore possible duplicate column errors
    const roleText = roleLevel === 2 ? 'admin' : roleLevel === 1 ? 'manager' : 'user';
    db.run('UPDATE users SET role_level = ?, role = ? WHERE id = ?', [roleLevel, roleText, userId], function (err) {
      if (err) {
        console.error('Update failed:', err);
        process.exitCode = 1;
        db.close();
        return;
      }
      console.log(`OK: user #${userId} role_level=${roleLevel} (${roleText})`);
      db.close();
    });
  });
});
