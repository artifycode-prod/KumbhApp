const { query } = require('../config/database');

const toSOS = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    location: {
      latitude: row.location_latitude,
      longitude: row.location_longitude,
      address: row.location_address || '',
    },
    message: row.message || '',
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
};

exports.create = async (data) => {
  const res = await query(
    `INSERT INTO sos (user_id, location_latitude, location_longitude, location_address, message, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.userId || null,
      data.location.latitude,
      data.location.longitude,
      data.location.address || '',
      data.message || '',
      data.priority || 'high',
    ]
  );
  return toSOS(res.rows[0]);
};

exports.findById = async (id) => {
  const res = await query('SELECT * FROM sos WHERE id = $1', [id]);
  return res.rows[0] ? toSOS(res.rows[0]) : null;
};

exports.find = async (filter = {}) => {
  let sql = 'SELECT * FROM sos WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.status) {
    sql += ` AND status = $${i++}`;
    params.push(filter.status);
  }
  if (filter.priority) {
    sql += ` AND priority = $${i++}`;
    params.push(filter.priority);
  }
  if (filter.assignedTo) {
    sql += ` AND assigned_to = $${i++}`;
    params.push(filter.assignedTo);
  }
  if (filter.userId) {
    sql += ` AND user_id = $${i++}`;
    params.push(String(filter.userId));
  }
  if (filter.statusIn) {
    sql += ` AND status = ANY($${i++})`;
    params.push(filter.statusIn);
  }
  sql += ' ORDER BY created_at DESC';
  const res = await query(sql, params);
  return res.rows.map(toSOS);
};

exports.countDocuments = async (filter = {}) => {
  let sql = 'SELECT COUNT(*) FROM sos WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.status) {
    sql += ` AND status = $${i++}`;
    params.push(filter.status);
  }
  if (filter.assignedTo) {
    sql += ` AND assigned_to = $${i++}`;
    params.push(filter.assignedTo);
  }
  if (filter.statusIn) {
    sql += ` AND status = ANY($${i++})`;
    params.push(filter.statusIn);
  }
  const res = await query(sql, params);
  return parseInt(res.rows[0].count, 10);
};

exports.update = async (id, updates) => {
  const sets = [];
  const params = [];
  let i = 1;
  if (updates.status !== undefined) {
    sets.push(`status = $${i++}`);
    params.push(updates.status);
  }
  if (updates.assignedTo !== undefined) {
    sets.push(`assigned_to = $${i++}`);
    params.push(updates.assignedTo);
  }
  if (updates.resolvedAt !== undefined) {
    sets.push(`resolved_at = $${i++}`);
    params.push(updates.resolvedAt);
  }
  if (sets.length === 0) return exports.findById(id);
  params.push(id);
  await query(`UPDATE sos SET ${sets.join(', ')} WHERE id = $${i}`, params);
  return exports.findById(id);
};
