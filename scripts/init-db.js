#!/usr/bin/env node
/**
 * Initialize PostgreSQL database with schema
 * Run: node scripts/init-db.js
 * Or: DATABASE_URL="your-connection-string" node scripts/init-db.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

if (!connectionString) {
  console.error('❌ DATABASE_URL or POSTGRES_URI not set');
  console.error('Set it in .env or run: DATABASE_URL="your-connection-string" node scripts/init-db.js');
  process.exit(1);
}

async function init() {
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: true } : false,
  });

  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log('🔄 Running schema...');
  await pool.query(schema);
  console.log('✅ Schema applied successfully!');

  await pool.end();

  // Seed dummy admin/volunteer/medical users
  console.log('🔄 Seeding dummy users...');
  require('child_process').execSync('node scripts/seed-users.js', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
}

init().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
