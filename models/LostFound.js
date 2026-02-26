// LostFound model - PostgreSQL backend
const db = require('../db/lostFound');

const LostFound = {
  create: async (data) => db.create(data),
  findById: async (id) => db.findById(id),
  find: async (filter) => db.find(filter),
  countDocuments: async (filter) => db.countDocuments(filter),
};

LostFound.findByIdAndUpdate = async (id, updates) => db.update(id, updates);

module.exports = LostFound;
