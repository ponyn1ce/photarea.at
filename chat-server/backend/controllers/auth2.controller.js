const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../database/init');
const tokenService = require('../services/token.service');
const mailService = require('../services/mail.service');

const MIN_PASSWORD_LENGTH = 8;

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateLinkToken() {
  return crypto.randomBytes(24).toString('hex');
}

function hashLinkToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function shouldUseSecureCookie(req) {
  // Works for internal HTTPS (USE_INTERNAL_SSL) and for reverse-proxy setups (nginx) via X-Forwarded-Proto
  const forwardedProto = (req.headers && req.headers['x-forwarded-proto']) || '';
  return Boolean(req.secure) || String(forwardedProto).toLowerCase() === 'https' || process.env.USE_INTERNAL_SSL === 'true';
}

function setAuthCookie(res, token, opts) {
  const options = opts || {};
  const cookieOptions = {
    httpOnly: true,
    secure: Boolean(options.secure),
    sameSite: 'lax',
    path: '/',
  };

  if (typeof options.maxAgeMs === 'number') cookieOptions.maxAge = options.maxAgeMs;

  res.cookie('auth_token', token, cookieOptions);
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
      const stmt = `INSERT INTO users (first_name, last_name, login, email, password_hash, verification_code, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?)`;
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

      // Auto-login after verification
      const token = tokenService.generateToken(user.id, { expiresIn: '1h' });
      setAuthCookie(res, token, { secure: shouldUseSecureCookie(req) });

      db.get('SELECT id, first_name, last_name, login, email, role, role_level FROM users WHERE id = ?', [user.id], (err, u) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!u) return res.status(404).json({ message: 'User not found' });
        const safeUser = {
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          login: u.login,
          email: u.email,
          role: u.role,
          role_level: Number(u.role_level ?? 0),
        };

        res.json({ message: 'Verified', user: safeUser, token });
      });
    });
  });
};

exports.checkEmail = (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Missing email' });
  
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // User exists. Here you normally send a password reset code.
    // For now the frontend just wants to know if user exists.
    res.json({ message: 'User exists' });
  });
};

exports.resend = (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Missing email' });
  
  db.get('SELECT id, is_verified FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(404).json({ message: 'User not found', code: 'EMAIL_NOT_FOUND' });

    const code = generateCode();
    const expires = Date.now() + 60 * 60 * 1000;
    
    db.run('UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?', [code, expires, user.id], function(err) {
      if (err) return res.status(500).json({ message: 'Failed to update code' });
      mailService.sendVerificationEmail(email, code).then(()=>{
        res.json({ message: 'Verification code resent' });
      }).catch(e=>{
        console.warn('resend mail failed', e);
        res.status(500).json({ message: 'Failed to send email' });
      });
    });
  });
};

exports.login = (req, res) => {
  const { loginOrEmail, password, rememberMe } = req.body;
  if (!loginOrEmail || !password) return res.status(400).json({ message: 'Missing credentials' });

  db.get('SELECT * FROM users WHERE email = ? OR login = ?', [loginOrEmail, loginOrEmail], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(401).json({ message: 'Пользователь не найден' });
    if (!user.is_verified) return res.status(403).json({ message: 'Email not verified' });

    bcrypt.compare(password, user.password_hash).then(match => {
      if (!match) return res.status(401).json({ message: 'Неправильный пароль' });
      const remember = Boolean(rememberMe);
      const token = tokenService.generateToken(user.id, { expiresIn: remember ? '365d' : '1h' });
      const safeUser = { 
        id: user.id, 
        first_name: user.first_name, 
        last_name: user.last_name, 
        login: user.login, 
        email: user.email,
        role: user.role,
        role_level: Number(user.role_level ?? 0)
      };

      // Persist auth in secure httpOnly cookie.
      // If rememberMe=true -> persistent cookie; else -> session cookie (until browser close)
      setAuthCookie(res, token, {
        secure: shouldUseSecureCookie(req),
        maxAgeMs: remember ? 365 * 24 * 60 * 60 * 1000 : undefined,
      });

      res.json({ user: safeUser, token });
    }).catch(() => res.status(500).json({ message: 'Comparison error' }));
  });
};

exports.logout = (req, res) => {
  const secure = shouldUseSecureCookie(req);
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ message: 'Logged out' });
};

exports.me = (req, res) => {
  const userId = req.userId;
  db.get('SELECT id, first_name, last_name, login, email, role, role_level FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  });
};

exports.updateMe = (req, res) => {
  const userId = req.userId;
  const { first_name, last_name, login, email, password } = req.body;

  // basic validation
  if (!first_name || !last_name || !login || !email) return res.status(400).json({ message: 'Missing fields' });

  // check uniqueness of login/email
  db.get('SELECT id FROM users WHERE (email = ? OR login = ?) AND id != ?', [email, login, userId], (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (row) return res.status(400).json({ message: 'Email or login already in use' });

    function doUpdate(hash) {
      const params = hash ? [first_name, last_name, login, email, hash, userId] : [first_name, last_name, login, email, userId];
      const stmt = hash ? 'UPDATE users SET first_name = ?, last_name = ?, login = ?, email = ?, password_hash = ? WHERE id = ?' : 'UPDATE users SET first_name = ?, last_name = ?, login = ?, email = ? WHERE id = ?';
      db.run(stmt, params, function(err) {
        if (err) return res.status(500).json({ message: 'Failed to update user' });
        db.get('SELECT id, first_name, last_name, login, email, role FROM users WHERE id = ?', [userId], (err, user) => {
          if (err) return res.status(500).json({ message: 'Database error' });
          res.json({ user });
        });
      });
    }

    if (password) {
      if (password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ message: 'Password too short' });
      bcrypt.hash(password, 10).then(hash => doUpdate(hash)).catch(()=>res.status(500).json({ message: 'Hashing error' }));
    } else {
      doUpdate(null);
    }
  });
};

// Скрытая привязка Telegram: выдача одноразового токена
exports.telegramLinkToken = (req, res) => {
  const userId = req.userId;
  const token = generateLinkToken();
  const tokenHash = hashLinkToken(token);
  const expires = Date.now() + 10 * 60 * 1000; // 10 минут

  db.run(
    'UPDATE users SET tg_link_token_hash = ?, tg_link_token_expires = ? WHERE id = ?',
    [tokenHash, expires, userId],
    function (err) {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ token, expires });
    }
  );
};

exports.verifyResetCode = (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ message: 'Missing email or code' });
  
  db.get('SELECT id, verification_code, verification_expires FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.verification_code || user.verification_code !== code) {
      return res.status(400).json({ message: 'Invalid code', code: 'INVALID_CODE' });
    }
    if (user.verification_expires && Number(user.verification_expires) < Date.now()) {
      return res.status(400).json({ message: 'Code expired', code: 'CODE_EXPIRED' });
    }
    
    res.json({ message: 'Code verified successfully' });
  });
};

exports.resetPassword = (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  
  db.get('SELECT id, verification_code, verification_expires FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.verification_code || user.verification_code !== code) {
      return res.status(400).json({ message: 'Invalid code', code: 'INVALID_CODE' });
    }
    if (user.verification_expires && Number(user.verification_expires) < Date.now()) {
      return res.status(400).json({ message: 'Code expired', code: 'CODE_EXPIRED' });
    }
    
    bcrypt.hash(newPassword, 10).then(hash => {
      db.run(
        'UPDATE users SET password_hash = ?, verification_code = NULL, verification_expires = NULL WHERE id = ?',
        [hash, user.id],
        function(err) {
          if (err) return res.status(500).json({ message: 'Failed to reset password' });
          res.json({ message: 'Password reset successfully' });
        }
      );
    }).catch(() => res.status(500).json({ message: 'Hashing error' }));
  });
};
