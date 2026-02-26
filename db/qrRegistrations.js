const { query } = require('../config/database');

const toQRRegistration = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    qrCodeId: row.qr_code_id,
    entryPoint: row.entry_point,
    entryPointName: row.entry_point_name,
    registeredBy: row.registered_by,
    groupSize: row.group_size,
    luggageCount: row.luggage_count,
    intendedDestination: row.intended_destination,
    customDestination: row.custom_destination,
    groupSelfie: row.group_selfie,
    location: {
      latitude: row.location_latitude,
      longitude: row.location_longitude,
      address: row.location_address || '',
    },
    contactInfo: {
      phone: row.contact_phone,
      name: row.contact_name || '',
    },
    registeredAt: row.registered_at,
  };
};

exports.create = async (data) => {
  const res = await query(
    `INSERT INTO qr_registrations (
      qr_code_id, entry_point, entry_point_name, registered_by, group_size, luggage_count,
      intended_destination, custom_destination, group_selfie,
      location_latitude, location_longitude, location_address, contact_phone, contact_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      data.qrCodeId,
      data.entryPoint,
      data.entryPointName,
      data.registeredBy || null,
      data.groupSize,
      data.luggageCount,
      data.intendedDestination,
      data.customDestination || null,
      data.groupSelfie,
      data.location.latitude,
      data.location.longitude,
      data.location.address || '',
      data.contactInfo.phone,
      data.contactInfo.name || '',
    ]
  );
  return toQRRegistration(res.rows[0]);
};

exports.findById = async (id) => {
  const res = await query('SELECT * FROM qr_registrations WHERE id = $1', [id]);
  return res.rows[0] ? toQRRegistration(res.rows[0]) : null;
};

exports.find = async (filter = {}, options = {}) => {
  let sql = 'SELECT * FROM qr_registrations WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.intendedDestination) {
    sql += ` AND intended_destination = $${i++}`;
    params.push(filter.intendedDestination);
  }
  if (filter.registeredAtGte) {
    sql += ` AND registered_at >= $${i++}`;
    params.push(filter.registeredAtGte);
  }
  if (filter.registeredAtLte) {
    sql += ` AND registered_at <= $${i++}`;
    params.push(filter.registeredAtLte);
  }
  if (filter.groupSelfieExists) {
    sql += ` AND group_selfie IS NOT NULL AND group_selfie != ''`;
  }
  sql += ' ORDER BY registered_at DESC';
  if (options.skip) {
    sql += ` OFFSET $${i++}`;
    params.push(options.skip);
  }
  if (options.limit) {
    sql += ` LIMIT $${i++}`;
    params.push(options.limit);
  }
  const res = await query(sql, params);
  return res.rows.map(toQRRegistration);
};

exports.countDocuments = async (filter = {}) => {
  let sql = 'SELECT COUNT(*) FROM qr_registrations WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.intendedDestination) {
    sql += ` AND intended_destination = $${i++}`;
    params.push(filter.intendedDestination);
  }
  if (filter.registeredAtGte) {
    sql += ` AND registered_at >= $${i++}`;
    params.push(filter.registeredAtGte);
  }
  const res = await query(sql, params);
  return parseInt(res.rows[0].count, 10);
};

exports.aggregateByDestination = async (filter = {}) => {
  let whereClause = 'WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.intendedDestination) {
    whereClause += ` AND intended_destination = $${i++}`;
    params.push(filter.intendedDestination);
  }
  if (filter.registeredAtGte) {
    whereClause += ` AND registered_at >= $${i++}`;
    params.push(filter.registeredAtGte);
  }
  if (filter.registeredAtLte) {
    whereClause += ` AND registered_at <= $${i++}`;
    params.push(filter.registeredAtLte);
  }
  const res = await query(
    `SELECT intended_destination, 
      COUNT(*) as total_groups, 
      SUM(group_size)::int as total_people, 
      SUM(luggage_count)::int as total_luggage,
      MAX(registered_at) as last_registration
     FROM qr_registrations ${whereClause}
     GROUP BY intended_destination
     ORDER BY total_people DESC`,
    params
  );
  return res.rows.map((r) => ({
    _id: r.intended_destination,
    totalGroups: parseInt(r.total_groups, 10),
    totalPeople: parseInt(r.total_people, 10),
    totalLuggage: parseInt(r.total_luggage, 10),
    lastRegistration: r.last_registration,
  }));
};
