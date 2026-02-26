const express = require('express');
const { body, validationResult } = require('express-validator');
const QRRegistration = require('../models/QRRegistration');
const { protect } = require('../middleware/auth');
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

router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'QR Registration endpoint is accessible',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path
  });
});

const ENTRY_LABELS = { railway_station: 'Railway Station', bus_stand: 'Bus Stand', parking_area: 'Parking Area', other: 'Other' };
const VALID_QR_ID = 'Kumbhbharat Registration';

const isValidQRCodeId = (value) => {
  const trimmed = String(value || '').trim();
  if (trimmed === VALID_QR_ID) return true;
  try {
    const parsed = JSON.parse(value);
    return parsed?.id === VALID_QR_ID || parsed?.qrCodeId === VALID_QR_ID;
  } catch {
    return false;
  }
};

router.post('/register', [
  body('qrCodeId').trim().notEmpty().withMessage('QR Code ID is required')
    .custom((v) => isValidQRCodeId(v)).withMessage('Only Bharat Kumbh registration QR codes are accepted'),
  body('entryPoint').isIn(['railway_station', 'bus_stand', 'parking_area', 'other']).withMessage('Invalid entry point'),
  body('entryPointName').optional().trim(),
  body('groupSize').isInt({ min: 1, max: 50 }).withMessage('Group size must be between 1 and 50'),
  body('luggageCount').isInt({ min: 1, max: 20 }).withMessage('Luggage count must be between 1 and 20'),
  body('intendedDestination').isIn(['Tapovan', 'Panchvati', 'Trambak', 'Ramkund', 'Kalaram', 'Sita Gufa', 'Other']).withMessage('Invalid destination'),
  body('groupSelfie').optional().trim(),
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required'),
  body('contactInfo.phone').trim().notEmpty().withMessage('Contact phone is required')
    .custom((v) => /^\d{10}$/.test(String(v).replace(/\D/g, ''))).withMessage('Contact phone must be exactly 10 digits'),
  body('contactInfo.name').optional().trim()
    .custom((v) => !v || /^[a-zA-Z\s]+$/.test(v)).withMessage('Contact name can only contain letters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map(e => e.msg).join('; ');
      return res.status(400).json({ success: false, message: msg, errors: errors.array() });
    }
    if (!(await checkDb(res))) return;

    const {
      qrCodeId, entryPoint, entryPointName, groupSize, luggageCount,
      intendedDestination, customDestination, groupSelfie,
      latitude, longitude, address, contactInfo
    } = req.body;

    const resolvedEntryPointName = (entryPointName || '').trim() || ENTRY_LABELS[entryPoint] || 'Entry Point';
    const resolvedSelfie = (groupSelfie || '').trim() || 'captured';

    const registration = await Promise.race([
      QRRegistration.create({
        qrCodeId,
        entryPoint,
        entryPointName: resolvedEntryPointName,
        registeredBy: req.user?.id || null,
        groupSize,
        luggageCount,
        intendedDestination,
        customDestination: intendedDestination === 'Other' ? customDestination : undefined,
        groupSelfie: resolvedSelfie,
        location: { latitude, longitude, address: address || '' },
        contactInfo: { phone: contactInfo.phone, name: contactInfo.name || '' }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database operation timeout')), 5000))
    ]);

    const io = req.app.get('io');
    if (io) {
      io.emit('crowd-update', {
        destination: intendedDestination,
        groupSize,
        timestamp: registration.registeredAt
      });
    }

    res.status(201).json({ success: true, registration });
  } catch (error) {
    console.error('QR Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/analytics', protect, async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const { destination, startDate, endDate } = req.query;
    const filter = {};
    if (destination) filter.intendedDestination = destination;
    if (startDate) filter.registeredAtGte = new Date(startDate);
    if (endDate) filter.registeredAtLte = new Date(endDate);

    const analytics = await QRRegistration.aggregate([{ $match: filter }]);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFilter = { ...filter, registeredAtGte: oneHourAgo };
    const recentCount = await QRRegistration.countDocuments(recentFilter);

    res.json({
      success: true,
      analytics,
      recentRegistrations: recentCount,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/destinations/:destination/crowd-status', async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const { destination } = req.params;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentRegistrations = await QRRegistration.find({
      intendedDestination: destination,
      registeredAtGte: oneHourAgo
    });

    const totalPeople = recentRegistrations.reduce((sum, reg) => sum + reg.groupSize, 0);
    let crowdLevel = 'low';
    if (totalPeople > 1000) crowdLevel = 'high';
    else if (totalPeople > 500) crowdLevel = 'moderate';

    res.json({
      success: true,
      destination,
      crowdLevel,
      estimatedPeople: totalPeople,
      groupsInLastHour: recentRegistrations.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get crowd status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/registrations', async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const registrations = await QRRegistration.find({}, { skip, limit });
    const total = await QRRegistration.countDocuments({});

    res.json({
      success: true,
      registrations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
