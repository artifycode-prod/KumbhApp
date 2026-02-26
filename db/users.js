const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const toUser = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    location: {
      latitude: row.location_latitude,
      longitude: row.location_longitude,
      lastUpdated: row.location_last_updated,
    },
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

exports.findById = async (id) => {
  if (!id || typeof id !== 'string') return null;
  const res = await query('SELECT id, name, email, phone, role, location_latitude, location_longitude, location_last_updated, is_active, created_at, updated_at FROM users WHERE id = $1', [id]);
  return res.rows[0] ? toUser(res.rows[0]) : null;
};

exports.findByEmail = async (email) => {
  const res = await query('SELECT id, name, email, phone, role, location_latitude, location_longitude, location_last_updated, is_active, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  return res.rows[0] ? toUser(res.rows[0]) : null;
};

exports.findByEmailWithPassword = async (email) => {
  const res = await query('SELECT id, name, email, phone, password, role, location_latitude, location_longitude, location_last_updated, is_active, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  if (!res.rows[0]) return null;
  const u = toUser(res.rows[0]);
  u.password = res.rows[0].password;
  u.comparePassword = async (candidate) => bcrypt.compare(candidate, res.rows[0].password);
  return u;
};

exports.findByIdWithPassword = async (id) => {
  if (!id || typeof id !== 'string') return null;
  const res = await query('SELECT id, name, email, phone, password, role, location_latitude, location_longitude, location_last_updated, is_active, created_at, updated_at FROM users WHERE id = $1', [id]);
  if (!res.rows[0]) return null;
  const u = toUser(res.rows[0]);
  u.password = res.rows[0].password;
  u.comparePassword = async (candidate) => bcrypt.compare(candidate, res.rows[0].password);
  return u;
};

exports.findOne = async (filter) => {
  if (filter.email) return exports.findByEmail(filter.email);
  if (filter.id || filter._id) return exports.findById(filter.id || filter._id);
  return null;
};

exports.create = async (data) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(data.password, salt);
  const res = await query(
    `INSERT INTO users (name, email, phone, password, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, phone, role, is_active, created_at, updated_at`,
    [data.name, data.email.toLowerCase(), data.phone, hashedPassword, data.role || 'pilgrim']
  );
  return toUser(res.rows[0]);
};

exports.comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

exports.getPasswordForUser = async (id) => {
  const res = await query('SELECT password FROM users WHERE id = $1', [id]);
  return res.rows[0]?.password || null;
};

exports.updateLocation = async (id, latitude, longitude) => {
  await query(
    `UPDATE users SET location_latitude = $1, location_longitude = $2, location_last_updated = NOW(), updated_at = NOW() WHERE id = $3`,
    [latitude, longitude, id]
  );
  return exports.findById(id);
};

exports.findByIdAndUpdate = async (id, updates) => {
  if (updates.isActive !== undefined) {
    await query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [updates.isActive, id]);
  }
  if (updates['location.latitude'] !== undefined) {
    await query(
      'UPDATE users SET location_latitude = $1, location_longitude = $2, location_last_updated = NOW(), updated_at = NOW() WHERE id = $3',
      [updates['location.latitude'], updates['location.longitude'], id]
    );
  }
  return exports.findById(id);
};

exports.find = async (filter = {}) => {
  let sql = 'SELECT id, name, email, phone, role, location_latitude, location_longitude, location_last_updated, is_active, created_at, updated_at FROM users WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.role) {
    sql += ` AND role = $${i++}`;
    params.push(filter.role);
  }
  sql += ' ORDER BY created_at DESC';
  const res = await query(sql, params);
  return res.rows.map(toUser);
};

exports.countDocuments = async (filter = {}) => {
  let sql = 'SELECT COUNT(*) FROM users WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.role) {
    sql += ` AND role = $${i++}`;
    params.push(filter.role);
  }
  const res = await query(sql, params);
  return parseInt(res.rows[0].count, 10);
};
