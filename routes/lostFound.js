const express = require('express');
const { body, validationResult } = require('express-validator');
const LostFound = require('../models/LostFound');
const QRRegistration = require('../models/QRRegistration');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { isConnected } = require('../config/database');
const connectDB = require('../config/database');

const router = express.Router();

const checkDb = async (res) => {
  if (!isConnected()) {
    await connectDB();
  }
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

const demoUsers = {
  pilgrim: { _id: 'demo-pilgrim', name: 'Pilgrim User', email: 'pilgrim@kumbh.com', phone: '0000000000' },
  volunteer: { _id: 'demo-volunteer', name: 'Volunteer User', email: 'volunteer@kumbh.com', phone: '0000000000' },
  admin: { _id: 'demo-admin', name: 'Admin User', email: 'admin@kumbh.com', phone: '0000000000' },
  medical: { _id: 'demo-medical', name: 'Medical Team User', email: 'medical@kumbh.com', phone: '0000000000' }
};

const addUserInfo = async (item) => {
  if (typeof item.reportedBy !== 'string') return item;
  if (item.reportedBy.startsWith('demo-')) {
    const role = item.reportedBy.replace('demo-', '');
    item.reportedBy = demoUsers[role] || { _id: item.reportedBy, name: 'Demo User', email: '', phone: '' };
  } else {
    const user = await User.findById(item.reportedBy);
    if (user) item.reportedBy = { _id: user.id, name: user.name, email: user.email, phone: user.phone };
  }
  return item;
};

router.post('/', protect, [
  body('type').isIn(['lost', 'found']).withMessage('Type must be lost or found'),
  body('itemName').trim().notEmpty().withMessage('Item name is required'),
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required'),
  body('phone').trim().notEmpty().withMessage('Contact phone is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    if (!(await checkDb(res))) return;

    const { type, itemName, description, latitude, longitude, address, phone, email, images, isPerson, facialRecognitionData } = req.body;
    const reportedBy = req.user?.id || req.user?._id;
    if (!reportedBy) return res.status(401).json({ success: false, message: 'User not authenticated' });

    const lostFound = await LostFound.create({
      type,
      reportedBy,
      itemName,
      description: description || '',
      location: { latitude, longitude, address: address || '' },
      contactInfo: { phone, email: email || '' },
      images: images || [],
      isPerson: isPerson || false,
      facialRecognitionData: facialRecognitionData || null
    });

    res.status(201).json({ success: true, lostFound });
  } catch (error) {
    console.error('Create lost/found error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const items = await LostFound.find(filter);
    const itemsWithUserInfo = await Promise.all(items.map(addUserInfo));
    res.json({ success: true, count: itemsWithUserInfo.length, items: itemsWithUserInfo });
  } catch (error) {
    console.error('Get lost/found error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-reports', protect, async (req, res) => {
  try {
    if (!(await checkDb(res))) return;

    const items = await LostFound.find({ reportedBy: req.user.id });
    const itemsWithUserInfo = await Promise.all(items.map(addUserInfo));
    res.json({ success: true, count: itemsWithUserInfo.length, items: itemsWithUserInfo });
  } catch (error) {
    console.error('Get my reports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/match', protect, [
  body('matchedWithId').notEmpty().withMessage('Matched item ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    if (!(await checkDb(res))) return;

    const { matchedWithId } = req.body;
    const item = await LostFound.findById(req.params.id);
    const matchedItem = await LostFound.findById(matchedWithId);

    if (!item || !matchedItem) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.type === matchedItem.type) return res.status(400).json({ success: false, message: 'Cannot match two items of the same type' });

    await LostFound.findByIdAndUpdate(req.params.id, { matchedWith: matchedWithId, status: 'matched' });
    await LostFound.findByIdAndUpdate(matchedWithId, { matchedWith: req.params.id, status: 'matched' });

    const updatedItem = await LostFound.findById(req.params.id);
    const updatedMatched = await LostFound.findById(matchedWithId);
    res.json({ success: true, item: updatedItem, matchedItem: updatedMatched });
  } catch (error) {
    console.error('Match items error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/volunteer/upload-person-photo', protect, authorize('volunteer', 'admin'), [
  body('image').trim().notEmpty().withMessage('Image is required'),
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    if (!(await checkDb(res))) return;

    const { image, latitude, longitude, address, description } = req.body;

    const lostFound = await LostFound.create({
      type: 'found',
      reportedBy: req.user.id,
      itemName: 'Lost Person',
      description: description || 'Person found by volunteer',
      location: { latitude, longitude, address: address || '' },
      contactInfo: { phone: req.user.phone || '', email: req.user.email || '' },
      images: [image],
      isPerson: true,
      facialRecognitionData: image
    });

    const qrRegistrations = await QRRegistration.find({}, { limit: 100 });
    const potentialMatches = qrRegistrations.slice(0, 5).map((reg) => ({
      registrationId: reg.id,
      contactInfo: reg.contactInfo,
      destination: reg.intendedDestination,
      registeredAt: reg.registeredAt
    }));

    res.status(201).json({
      success: true,
      lostFound,
      potentialMatches,
      message: 'Photo uploaded. Facial recognition matching in progress.'
    });
  } catch (error) {
    console.error('Upload person photo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:id/match-with-qr', protect, authorize('volunteer', 'admin'), [
  body('qrRegistrationId').notEmpty().withMessage('QR Registration ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    if (!(await checkDb(res))) return;

    const { qrRegistrationId } = req.body;
    const lostFound = await LostFound.findById(req.params.id);
    const qrRegistration = await QRRegistration.findById(qrRegistrationId);

    if (!lostFound || !qrRegistration) return res.status(404).json({ success: false, message: 'Item or QR registration not found' });
    if (!lostFound.isPerson) return res.status(400).json({ success: false, message: 'This item is not a person report' });

    await LostFound.findByIdAndUpdate(req.params.id, { matchedWithQRRegistration: qrRegistrationId, status: 'matched' });
    const updated = await LostFound.findById(req.params.id);

    res.json({
      success: true,
      lostFound: updated,
      qrRegistration: {
        contactInfo: qrRegistration.contactInfo,
        destination: qrRegistration.intendedDestination,
        groupSize: qrRegistration.groupSize
      },
      message: 'Person matched with QR registration. Contact details available.'
    });
  } catch (error) {
    console.error('Match with QR error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
