const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

exports.generateToken = (userId, options) => {
  // Backward compatible:
  // - generateToken(userId)
  // - generateToken(userId, '30d')
  // - generateToken(userId, { expiresIn: '30d' })
  const expiresIn =
    typeof options === 'string'
      ? options
      : options && typeof options === 'object' && options.expiresIn
        ? options.expiresIn
        : '1h';

  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn });
};

exports.verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
