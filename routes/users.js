const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
// const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/users
// @desc    Create user (signup) - pilgrim only
// @access  Public
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { name, email, phone, password } = req.body;
    const role = 'pilgrim';

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const user = await User.create({ name, email, phone, password, role });
    const token = generateToken(user.id || user._id);

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id || user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// @route   POST /api/users/login
// @desc    Login user (by email or user id + password)
// @body    email OR id (user id), password
// @access  Public
router.post('/login', [
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
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
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    const token = generateToken(user.id || user._id);
    const { password: _pwd, comparePassword: _cmp, ...userForResponse } = user;
    res.json({ success: true, token, user: userForResponse });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// @route   GET /api/users
// @desc    Get all users from database (no password in response)
// @query   role - optional filter by role (pilgrim, volunteer, admin, medical)
// @access  Public (add protect + authorize('admin') for production)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const users = await User.find(filter);
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
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

module.exports = router;

