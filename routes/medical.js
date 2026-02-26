const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { isConnected } = require('../config/database');
const MedicalCase = require('../models/MedicalCase');

const router = express.Router();

const checkDb = (res) => {
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

// @route   POST /api/medical/cases
// @desc    Create medical case
// @access  Private
router.post('/cases', protect, [
  body('caseType').isIn(['emergency', 'consultation', 'medication', 'checkup']).withMessage('Invalid case type'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    if (!checkDb(res)) return;

    const {
      patientId, patientName, patientAge, patientGender,
      caseType, description, medicalIssue, allergies, emergencyContact,
      symptoms, severity, latitude, longitude, address
    } = req.body;

    const reportedBy = req.user?.id || req.user?._id;
    const finalPatientId = patientId || reportedBy || null;

    if (!reportedBy) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const medicalCase = await MedicalCase.create({
      patientId: finalPatientId,
      patientName: patientName || (req.user?.name || 'Unknown'),
      patientAge: patientAge || null,
      patientGender: patientGender || '',
      reportedBy,
      caseType,
      description,
      medicalIssue: medicalIssue || description,
      allergies: allergies || '',
      emergencyContact: emergencyContact || '',
      symptoms: symptoms || [],
      severity: severity || 'medium',
      location: { latitude, longitude, address: address || '' }
    });

    if (caseType === 'emergency' || severity === 'critical') {
      const io = req.app.get('io');
      if (io) {
        io.emit('emergency-notification', {
          id: medicalCase.id,
          caseType: medicalCase.caseType,
          severity: medicalCase.severity,
          location: medicalCase.location,
          createdAt: medicalCase.createdAt
        });
      }
    }

    res.status(201).json({ success: true, medicalCase });
  } catch (error) {
    console.error('Create medical case error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// @route   GET /api/medical/cases
router.get('/cases', protect, authorize('medical', 'admin'), async (req, res) => {
  try {
    if (!checkDb(res)) return;

    const { status, caseType, severity } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (caseType) filter.caseType = caseType;
    if (severity) filter.severity = severity;

    const cases = await MedicalCase.find(filter);
    res.json({ success: true, count: cases.length, cases });
  } catch (error) {
    console.error('Get medical cases error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/medical/cases/my-cases
router.get('/cases/my-cases', protect, async (req, res) => {
  try {
    if (!checkDb(res)) return;

    const userId = req.user?.id || req.user?._id;
    const cases = await MedicalCase.find({ patientOrReportedBy: userId });
    res.json({ success: true, count: cases.length, cases });
  } catch (error) {
    console.error('Get my cases error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/medical/cases/:id/assign
router.put('/cases/:id/assign', protect, authorize('medical', 'admin'), [
  body('assignedTo').notEmpty().withMessage('Staff ID is required')
], async (req, res) => {
  try {
    if (!checkDb(res)) return;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const medicalCase = await MedicalCase.findById(req.params.id);
    if (!medicalCase) return res.status(404).json({ success: false, message: 'Medical case not found' });

    const updated = await MedicalCase.findByIdAndUpdate(req.params.id, {
      assignedTo: req.body.assignedTo,
      status: 'in-progress'
    });
    res.json({ success: true, medicalCase: updated });
  } catch (error) {
    console.error('Assign case error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/medical/cases/:id/add-note
router.put('/cases/:id/add-note', protect, authorize('medical', 'admin'), [
  body('note').trim().notEmpty().withMessage('Note is required')
], async (req, res) => {
  try {
    if (!checkDb(res)) return;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const medicalCase = await MedicalCase.findById(req.params.id);
    if (!medicalCase) return res.status(404).json({ success: false, message: 'Medical case not found' });

    const notes = [...(medicalCase.medicalNotes || []), {
      note: req.body.note,
      addedBy: req.user.id,
      addedAt: new Date()
    }];
    const updated = await MedicalCase.findByIdAndUpdate(req.params.id, { medicalNotes: notes });
    res.json({ success: true, medicalCase: updated });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/medical/cases/:id/resolve
router.put('/cases/:id/resolve', protect, authorize('medical', 'admin'), async (req, res) => {
  try {
    if (!checkDb(res)) return;

    const medicalCase = await MedicalCase.findById(req.params.id);
    if (!medicalCase) return res.status(404).json({ success: false, message: 'Medical case not found' });

    const updated = await MedicalCase.findByIdAndUpdate(req.params.id, {
      status: 'resolved',
      resolvedAt: new Date()
    });
    res.json({ success: true, medicalCase: updated });
  } catch (error) {
    console.error('Resolve case error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
