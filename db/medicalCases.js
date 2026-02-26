const { query } = require('../config/database');

const toMedicalCase = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientAge: row.patient_age,
    patientGender: row.patient_gender,
    reportedBy: row.reported_by,
    caseType: row.case_type,
    description: row.description,
    medicalIssue: row.medical_issue,
    allergies: row.allergies,
    emergencyContact: row.emergency_contact,
    symptoms: row.symptoms || [],
    severity: row.severity,
    location: {
      latitude: row.location_latitude,
      longitude: row.location_longitude,
      address: row.location_address || '',
    },
    status: row.status,
    assignedTo: row.assigned_to,
    medicalNotes: Array.isArray(row.medical_notes) ? row.medical_notes : (row.medical_notes ? JSON.parse(row.medical_notes) : []),
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
};

exports.create = async (data) => {
  const res = await query(
    `INSERT INTO medical_cases (
      patient_id, patient_name, patient_age, patient_gender, reported_by, case_type,
      description, medical_issue, allergies, emergency_contact, symptoms, severity,
      location_latitude, location_longitude, location_address, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      data.patientId || null,
      data.patientName,
      data.patientAge || null,
      data.patientGender || '',
      data.reportedBy,
      data.caseType,
      data.description,
      data.medicalIssue || data.description,
      data.allergies || '',
      data.emergencyContact || '',
      JSON.stringify(data.symptoms || []),
      data.severity || 'medium',
      data.location.latitude,
      data.location.longitude,
      data.location.address || '',
      data.status || 'pending',
    ]
  );
  return toMedicalCase(res.rows[0]);
};

exports.findById = async (id) => {
  const res = await query('SELECT * FROM medical_cases WHERE id = $1', [id]);
  return res.rows[0] ? toMedicalCase(res.rows[0]) : null;
};

exports.find = async (filter = {}) => {
  let sql = 'SELECT * FROM medical_cases WHERE 1=1';
  const params = [];
  let i = 1;
  if (filter.status) {
    sql += ` AND status = $${i++}`;
    params.push(filter.status);
  }
  if (filter.caseType) {
    sql += ` AND case_type = $${i++}`;
    params.push(filter.caseType);
  }
  if (filter.severity) {
    sql += ` AND severity = $${i++}`;
    params.push(filter.severity);
  }
  if (filter.patientOrReportedBy) {
    const uid = filter.patientOrReportedBy;
    sql += ` AND (patient_id = $${i} OR reported_by = $${i})`;
    params.push(String(uid));
    i++;
  }
  sql += ' ORDER BY created_at DESC';
  const res = await query(sql, params);
  return res.rows.map(toMedicalCase);
};

exports.countDocuments = async (filter = {}) => {
  let sql = 'SELECT COUNT(*) FROM medical_cases WHERE 1=1';
  const params = [];
  let i = 1;
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
  if (updates.assignedTo !== undefined) {
    sets.push(`assigned_to = $${i++}`);
    params.push(updates.assignedTo);
  }
  if (updates.status !== undefined) {
    sets.push(`status = $${i++}`);
    params.push(updates.status);
  }
  if (updates.resolvedAt !== undefined) {
    sets.push(`resolved_at = $${i++}`);
    params.push(updates.resolvedAt);
  }
  if (updates.medicalNotes !== undefined) {
    sets.push(`medical_notes = $${i++}`);
    params.push(JSON.stringify(updates.medicalNotes));
  }
  if (sets.length === 0) return exports.findById(id);
  params.push(id);
  await query(`UPDATE medical_cases SET ${sets.join(', ')} WHERE id = $${i}`, params);
  return exports.findById(id);
};
