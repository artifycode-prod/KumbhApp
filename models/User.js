// User model - PostgreSQL backend
const db = require('../db/users');

// Wrapper to match Mongoose-style API for compatibility
const User = {
  findById: async (id) => db.findById(id),
  findOne: async (filter) => db.findOne(filter),
  find: async (filter) => db.find(filter),
  create: async (data) => db.create(data),
  countDocuments: async (filter) => db.countDocuments(filter),
  findByIdAndUpdate: async (id, updates) => db.findByIdAndUpdate(id, updates),
};

// For login - need user with password (by email or id)
User.findOneWithPassword = async (filter) => {
  if (filter.email) return db.findByEmailWithPassword(filter.email);
  if (filter.id || filter._id) return db.findByIdWithPassword(filter.id || filter._id);
  return null;
};

module.exports = User;
