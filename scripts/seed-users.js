#!/usr/bin/env node
/**
 * Seed dummy admin, volunteer, and medical users into PostgreSQL
 * Run: node scripts/seed-users.js
 * Or: DATABASE_URL="your-connection-string" node scripts/seed-users.js
 */
require('dotenv').config();
const userDb = require('../db/users');

const DUMMY_USERS = [
  { email: 'admin@kumbh.com', password: 'admin', role: 'admin', name: 'Admin User', phone: '0000000001' },
  { email: 'volunteer@kumbh.com', password: 'volunteer', role: 'volunteer', name: 'Volunteer User', phone: '0000000002' },
  { email: 'medical@kumbh.com', password: 'medical', role: 'medical', name: 'Medical Team User', phone: '0000000003' },
];

async function seed() {
  for (const u of DUMMY_USERS) {
    const existing = await userDb.findByEmail(u.email);
    if (existing) {
      console.log(`⏭️  ${u.email} already exists, skipping`);
      continue;
    }
    await userDb.create(u);
    console.log(`✅ Created ${u.role}: ${u.email}`);
  }
  console.log('✅ Seed complete');
}

seed().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
