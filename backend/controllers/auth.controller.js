const bcrypt = require('bcrypt');
const db = require('../database/init');
const tokenService = require('../services/token.service');
const mailService = require('../services/mail.service');

const MIN_PASSWORD_LENGTH = 8;

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.register = (req, res) => {
  const { first_name, last_name, login, email, password } = req.body;
  if (!first_name || !last_name || !login || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  db.get('SELECT id FROM users WHERE email = ? OR login = ?', [email, login], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (row) return res.status(400).json({ message: 'Email or login already in use' });

    bcrypt.hash(password, 10).then(hash => {
      const code = generateCode();
      const expires = Date.now() + 60 * 60 * 1000; // 1 hour
      const stmt = `INSERT INTO users (first_name, last_name, login, email, password_hash, verification_code, verification_expires, role) VALUES (?, ?, ?, ?, ?, ?, ?, 'user')`;
      db.run(stmt, [first_name, last_name, login, email, hash, code, expires], function(err) {
        if (err) return res.status(500).json({ message: 'Failed to create user' });
        // send verification email (best-effort)
        mailService.sendVerificationEmail(email, code).catch(e => console.warn('mail send failed', e));
        res.status(201).json({ message: 'User created. Verification code sent to email.' });
      });
    }).catch(() => res.status(500).json({ message: 'Hashing error' }));
  });
};

exports.verify = (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ message: 'Missing email or code' });
  db.get('SELECT id, verification_code, verification_expires FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.verification_code || user.verification_code !== code) return res.status(400).json({ message: 'Invalid code' });
    if (user.verification_expires && Number(user.verification_expires) < Date.now()) return res.status(400).json({ message: 'Code expired' });

    db.run('UPDATE users SET is_verified = 1, verification_code = NULL, verification_expires = NULL WHERE id = ?', [user.id], function(err) {
      if (err) return res.status(500).json({ message: 'Failed to verify user' });
      const token = tokenService.generateToken(user.id);
      res.json({ message: 'Verified', token });
    });
  });
};

exports.login = (req, res) => {
  const { loginOrEmail, password } = req.body;
  if (!loginOrEmail || !password) return res.status(400).json({ message: 'Missing credentials' });

  db.get('SELECT * FROM users WHERE email = ? OR login = ?', [loginOrEmail, loginOrEmail], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.is_verified) return res.status(403).json({ message: 'Email not verified' });

    bcrypt.compare(password, user.password_hash).then(match => {
      if (!match) return res.status(401).json({ message: 'Invalid credentials' });
      const token = tokenService.generateToken(user.id);
      const safeUser = { 
        id: user.id, 
        first_name: user.first_name, 
        last_name: user.last_name, 
        login: user.login, 
        email: user.email,
        role: user.role 
      };
      res.json({ user: safeUser, token });
    }).catch(() => res.status(500).json({ message: 'Comparison error' }));
  });
};

exports.me = (req, res) => {
  const userId = req.userId;
  db.get('SELECT id, first_name, last_name, login, email, role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  });
};

exports.updateMe = (req, res) => {
  const userId = req.userId;
  const { first_name, last_name, login, email, password } = req.body;
  
  const updateFields = [];
  const params = [];
  
  if (first_name) { updateFields.push('first_name = ?'); params.push(first_name); }
  if (last_name) { updateFields.push('last_name = ?'); params.push(last_name); }
  if (login) { updateFields.push('login = ?'); params.push(login); }
  if (email) { updateFields.push('email = ?'); params.push(email); }
  
  const finalizeUpdate = () => {
    params.push(userId);
    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ message: 'Update failed' });
      res.json({ message: 'Profile updated' });
    });
  };

  if (password) {
    bcrypt.hash(password, 10).then(hash => {
      updateFields.push('password_hash = ?');
      params.push(hash);
      finalizeUpdate();
    });
  } else {
    finalizeUpdate();
  }
};
