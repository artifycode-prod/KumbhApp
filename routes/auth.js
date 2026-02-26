const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { protect } = require('../middleware/auth');
// Rate limiting disabled - uncomment to enable
// const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Test endpoint - seeded dummy users (run db:seed to create)
router.get('/test-demo-logins', (req, res) => {
  res.json({
    success: true,
    message: 'Dummy users seeded in DB - run npm run db:seed if missing',
    serverTime: new Date().toISOString(),
    dummyUsers: [
      { email: 'admin@kumbh.com', password: 'admin', role: 'admin' },
      { email: 'volunteer@kumbh.com', password: 'volunteer', role: 'volunteer' },
      { email: 'medical@kumbh.com', password: 'medical', role: 'medical' }
    ]
  });
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', /* authLimiter, */ [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['pilgrim']).withMessage('Registration is for pilgrims only')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, phone, password } = req.body;
    const role = 'pilgrim'; // Only pilgrims can sign up; admin/volunteer/medical are pre-seeded

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user (pilgrim only - others are pre-seeded)
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role
    });

    // Generate token
    const token = generateToken(user.id || user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// GET /api/auth/login - Helpful response when accessed via browser (use POST for login)
router.get('/login', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Use POST method for login. Send { email, password } in JSON body.',
    hint: 'POST /api/auth/login with Content-Type: application/json'
  });
});

// @route   POST /api/auth/login
// @desc    Login user (by email or user id + password)
// @access  Public
router.post('/login', /* authLimiter, */ [
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, id, password } = req.body;
    const identifier = (id || email || '').toString().trim();
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Email or user ID is required' });
    }

    let user;
    const roleMap = { admin: 'admin@kumbh.com', volunteer: 'volunteer@kumbh.com', medical: 'medical@kumbh.com' };
    if (identifier.includes('@')) {
      const normalizedEmail = identifier.toLowerCase();
      user = await User.findOneWithPassword({ email: normalizedEmail });
    } else if (roleMap[identifier]) {
      user = await User.findOneWithPassword({ email: roleMap[identifier] });
    } else {
      user = await User.findOneWithPassword({ id: identifier });
    }
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Generate token
    const token = generateToken(user.id || user._id);

    // Return full user from database (exclude password)
    const { password: _pwd, comparePassword: _cmp, ...userForResponse } = user;
    res.json({
      success: true,
      token,
      user: userForResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/update-location
// @desc    Update user location
// @access  Private
router.put('/update-location', protect, [
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { latitude, longitude } = req.body;

    const user = await User.findByIdAndUpdate(req.user.id, {
      'location.latitude': latitude,
      'location.longitude': longitude,
      'location.lastUpdated': new Date()
    });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

