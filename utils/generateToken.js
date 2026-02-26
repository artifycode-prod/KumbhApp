const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  console.log('🔐 Generating token for:', id, 'with secret:', jwtSecret ? 'SET' : 'NOT SET');
  const token = jwt.sign({ id }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
  console.log('✅ Token generated, length:', token.length);
  return token;
};

module.exports = generateToken;

