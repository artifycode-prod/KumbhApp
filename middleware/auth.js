const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.log('❌ No token provided in request');
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route - No token provided'
      });
    }
    
    console.log('🔑 Token received:', token.substring(0, 20) + '...');

    try {
      // Verify token
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      console.log('🔐 Verifying token with secret:', jwtSecret ? 'SET' : 'NOT SET');
      const decoded = jwt.verify(token, jwtSecret);
      console.log('✅ Token decoded successfully:', { id: decoded.id, exp: decoded.exp });

      // Get user from database (admin/volunteer/medical are seeded via db:seed)
      req.user = await User.findById(decoded.id);
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      console.log('✅ User authenticated:', { id: req.user.id, role: req.user.role });
      next();
    } catch (err) {
      console.error('❌ Token verification error:', err.message);
      console.error('Token error details:', {
        name: err.name,
        message: err.message,
        expiredAt: err.expiredAt
      });
      return res.status(401).json({
        success: false,
        message: 'Not authorized - Token invalid or expired',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

