const { query } = require('../config/database');

const toLostFound = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    type: row.type,
    reportedBy: row.reported_by,
    itemName: row.item_name,
    description: row.description,
    location: {
      latitude: row.location_latitude,
      longitude: row.location_longitude,
      address: row.location_address || '',
    },
    contactInfo: {
      phone: row.contact_phone,
      email: row.contact_email || '',
    },
    images: Array.isArray(row.images) ? row.images : (row.images ? JSON.parse(row.images) : []),
    isPerson: row.is_person,
    facialRecognitionData: row.facial_recognition_data,
    matchedWithQRRegistration: row.matched_with_qr_registration,
    status: row.status,
    matchedWith: row.matched_with,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
};

exports.create = async (data) => {
  const res = await query(
    `INSERT INTO lost_found (
      type, reported_by, item_name, description,
      location_latitude, location_longitude, location_address,
      contact_phone, contact_email, images, is_person, facial_recognition_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      data.type,
      data.reportedBy,
      data.itemName,
      data.description || '',
      data.location.latitude,
      data.location.longitude,
      data.location.address || '',
      data.contactInfo.phone,
      data.contactInfo.email || '',
      JSON.stringify(data.images || []),
      data.isPerson || false,
      data.facialRecognitionData || null,
    ]
  );
  return toLostFound(res.rows[0]);
};

exports.findById = async (id) => {
  const res = await query('SELECT * FROM lost_found WHERE id = $1', [id]);
  return res.rows[0] ? toLostFound(res.rows[0]) : null;
};

exports.find = async (filter = {}) => {
  let sql = 'SELECT * FROM lost_found WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.type) {
    sql += ` AND type = $${i++}`;
    params.push(filter.type);
  }
  if (filter.status) {
    sql += ` AND status = $${i++}`;
    params.push(filter.status);
  }
  if (filter.reportedBy) {
    sql += ` AND reported_by = $${i++}`;
    params.push(filter.reportedBy);
  }
  sql += ' ORDER BY created_at DESC';
  const res = await query(sql, params);
  return res.rows.map(toLostFound);
};

exports.countDocuments = async (filter = {}) => {
  let sql = 'SELECT COUNT(*) FROM lost_found WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.type) {
    sql += ` AND type = $${i++}`;
    params.push(filter.type);
  }
  if (filter.status) {
    sql += ` AND status = $${i++}`;
    params.push(filter.status);
  }
  const res = await query(sql, params);
  return parseInt(res.rows[0].count, 10);
};

exports.update = async (id, updates) => {
  const sets = [];
  const params = [];
  let i = 1;
  if (updates.matchedWith !== undefined) {
    sets.push(`matched_with = $${i++}`);
    params.push(updates.matchedWith);
  }
  if (updates.matchedWithQRRegistration !== undefined) {
    sets.push(`matched_with_qr_registration = $${i++}`);
    params.push(updates.matchedWithQRRegistration);
  }
  if (updates.status !== undefined) {
    sets.push(`status = $${i++}`);
    params.push(updates.status);
  }
  if (sets.length === 0) return exports.findById(id);
  params.push(id);
  await query(`UPDATE lost_found SET ${sets.join(', ')} WHERE id = $${i}`, params);
  return exports.findById(id);
};
