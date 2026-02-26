// MedicalCase model - PostgreSQL backend
const db = require('../db/medicalCases');

const MedicalCase = {
  create: async (data) => db.create(data),
  findById: async (id) => db.findById(id),
  find: async (filter) => db.find(filter),
  countDocuments: async (filter) => db.countDocuments(filter),
};

MedicalCase.findByIdAndUpdate = async (id, updates) => {
  const current = await db.findById(id);
  if (!current) return null;
  const newNotes = updates.medicalNotes || current.medicalNotes;
  const updateObj = {};
  if (updates.assignedTo !== undefined) updateObj.assignedTo = updates.assignedTo;
  if (updates.status !== undefined) updateObj.status = updates.status;
  if (updates.resolvedAt !== undefined) updateObj.resolvedAt = updates.resolvedAt;
  if (updates.medicalNotes !== undefined) updateObj.medicalNotes = updates.medicalNotes;
  return db.update(id, updateObj);
};

module.exports = MedicalCase;
