// SOS model - PostgreSQL backend
const db = require('../db/sos');

const SOS = {
  create: async (data) => db.create(data),
  findById: async (id) => db.findById(id),
  find: async (filter) => db.find(filter),
  countDocuments: async (filter) => db.countDocuments(filter),
};

// For updates
SOS.findByIdAndUpdate = async (id, updates) => {
  await db.update(id, updates);
  return db.findById(id);
};

module.exports = SOS;
