const express = require('express');
const SOS = require('../models/SOS');
const LostFound = require('../models/LostFound');
const { protect, authorize } = require('../middleware/auth');
const { isConnected } = require('../config/database');

const router = express.Router();

router.use(protect);
router.use(authorize('volunteer', 'admin', 'medical'));

router.get('/dashboard', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const pendingSOS = await SOS.countDocuments({ status: 'pending' });
    const myAssignedSOS = await SOS.countDocuments({
      assignedTo: req.user.id,
      statusIn: ['pending', 'acknowledged']
    });
    const openLostFound = await LostFound.countDocuments({ status: 'open' });

    res.json({
      success: true,
      dashboard: {
        pendingSOS,
        myAssignedSOS,
        openLostFound
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/assigned-tasks', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const tasks = await SOS.find({
      assignedTo: req.user.id,
      statusIn: ['pending', 'acknowledged']
    });

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error('Get assigned tasks error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
