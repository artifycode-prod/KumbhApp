const express = require('express');
const { body, validationResult } = require('express-validator');
const SOS = require('../models/SOS');
const { protect, authorize } = require('../middleware/auth');
const { isConnected } = require('../config/database');
const connectDB = require('../config/database');

const router = express.Router();

const checkDb = async (res) => {
  if (!isConnected()) await connectDB();
  if (!isConnected()) {
    res.status(503).json({
      success: false,
      message: 'Database not connected. Please check DATABASE_URL connection.'
    });
    return false;
  }
  return true;
};

router.post('/', [
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required'),
  body('message').optional().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    if (!(await checkDb(res))) return;

    const { latitude, longitude, address, message, priority } = req.body;

    const sosData = {
      location: { latitude, longitude, address: address || '' },
      message: message || '',
      priority: priority || 'high'
    };
    if (req.user?.id) sosData.userId = req.user.id;

    const sos = await SOS.create(sosData);

    const io = req.app.get('io');
    if (io) {
      io.emit('sos-alert', {
        id: sos.id,
        userId: sos.userId,
        location: sos.location,
        message: sos.message,
        priority: sos.priority,
        createdAt: sos.createdAt
      });
    }

    res.status(201).json({ success: true, sos });
  } catch (error) {
    console.error('Create SOS error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
});

router.get('/', protect, authorize('volunteer', 'admin', 'medical'), async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const { status, priority } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const sosAlerts = await SOS.find(filter);
    res.json({ success: true, count: sosAlerts.length, sosAlerts });
  } catch (error) {
    console.error('Get SOS alerts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-sos', protect, async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const sosAlerts = await SOS.find({ userId: req.user.id });
    res.json({ success: true, count: sosAlerts.length, sosAlerts });
  } catch (error) {
    console.error('Get my SOS error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/acknowledge', protect, authorize('volunteer', 'admin', 'medical'), async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const sos = await SOS.findById(req.params.id);
    if (!sos) return res.status(404).json({ success: false, message: 'SOS alert not found' });

    const updated = await SOS.findByIdAndUpdate(req.params.id, {
      status: 'acknowledged',
      assignedTo: req.user.id
    });
    res.json({ success: true, sos: updated });
  } catch (error) {
    console.error('Acknowledge SOS error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/resolve', protect, authorize('volunteer', 'admin', 'medical'), async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const sos = await SOS.findById(req.params.id);
    if (!sos) return res.status(404).json({ success: false, message: 'SOS alert not found' });

    const updated = await SOS.findByIdAndUpdate(req.params.id, {
      status: 'resolved',
      resolvedAt: new Date()
    });
    res.json({ success: true, sos: updated });
  } catch (error) {
    console.error('Resolve SOS error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
