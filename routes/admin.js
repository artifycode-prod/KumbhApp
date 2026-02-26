const express = require('express');
const User = require('../models/User');
const SOS = require('../models/SOS');
const LostFound = require('../models/LostFound');
const MedicalCase = require('../models/MedicalCase');
const { isConnected } = require('../config/database');
const connectDB = require('../config/database');

const router = express.Router();

const checkDb = async (res) => {
  if (!isConnected()) await connectDB();
  if (!isConnected()) {
    res.status(503).json({
      success: false,
      message: 'Database not available. Please check DATABASE_URL connection.',
      hint: 'Check DATABASE_URL or POSTGRES_URI environment variable'
    });
    return false;
  }
  return true;
};

router.get('/dashboard', async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const totalUsers = await User.countDocuments();
    const totalVolunteers = await User.countDocuments({ role: 'volunteer' });
    const totalMedicalStaff = await User.countDocuments({ role: 'medical' });
    const pendingSOS = await SOS.countDocuments({ status: 'pending' });
    const resolvedSOS = await SOS.countDocuments({ status: 'resolved' });
    const openLostFound = await LostFound.countDocuments({ status: 'open' });
    const resolvedLostFound = await LostFound.countDocuments({ status: 'resolved' });
    const pendingMedicalCases = await MedicalCase.countDocuments({ status: 'pending' });
    const resolvedMedicalCases = await MedicalCase.countDocuments({ status: 'resolved' });

    res.json({
      success: true,
      dashboard: {
        users: { total: totalUsers, volunteers: totalVolunteers, medicalStaff: totalMedicalStaff },
        sos: { pending: pendingSOS, resolved: resolvedSOS },
        lostFound: { open: openLostFound, resolved: resolvedLostFound },
        medical: { pending: pendingMedicalCases, resolved: resolvedMedicalCases }
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/users/:id/activate', async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const user = await User.findByIdAndUpdate(req.params.id, { isActive: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/users/:id/deactivate', async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
