// QRRegistration model - PostgreSQL backend
const db = require('../db/qrRegistrations');

const QRRegistration = {
  create: async (data) => db.create(data),
  findById: async (id) => db.findById(id),
  find: async (filter, options) => db.find(filter, options),
  countDocuments: async (filter) => db.countDocuments(filter),
  aggregate: async (pipeline) => {
    // MongoDB-style aggregate for analytics
    const matchStage = pipeline.find((p) => p.$match);
    const filter = {};
    if (matchStage?.$match) {
      if (matchStage.$match.intendedDestination) filter.intendedDestination = matchStage.$match.intendedDestination;
      if (matchStage.$match.registeredAt?.$gte) filter.registeredAtGte = matchStage.$match.registeredAt.$gte;
      if (matchStage.$match.registeredAt?.$lte) filter.registeredAtLte = matchStage.$match.registeredAt.$lte;
    }
    return db.aggregateByDestination(filter);
  },
};

module.exports = QRRegistration;
