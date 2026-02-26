-- Bharat Kumbh PostgreSQL Schema
-- Run this against your Neon database to create tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'pilgrim' CHECK (role IN ('pilgrim', 'volunteer', 'admin', 'medical')),
  location_latitude DOUBLE PRECISION,
  location_longitude DOUBLE PRECISION,
  location_last_updated TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- SOS alerts table (user_id as TEXT to support demo users like 'demo-pilgrim')
CREATE TABLE IF NOT EXISTS sos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  location_latitude DOUBLE PRECISION NOT NULL,
  location_longitude DOUBLE PRECISION NOT NULL,
  location_address TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'cancelled')),
  priority VARCHAR(20) DEFAULT 'high' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sos_status ON sos(status);
CREATE INDEX IF NOT EXISTS idx_sos_created_at ON sos(created_at DESC);

-- Medical cases table
CREATE TABLE IF NOT EXISTS medical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT,
  patient_name VARCHAR(255) NOT NULL,
  patient_age INTEGER CHECK (patient_age >= 0 AND patient_age <= 150),
  patient_gender VARCHAR(20) DEFAULT '' CHECK (patient_gender IN ('male', 'female', 'other', '')),
  reported_by TEXT NOT NULL,
  case_type VARCHAR(30) NOT NULL CHECK (case_type IN ('emergency', 'consultation', 'medication', 'checkup')),
  description TEXT NOT NULL,
  medical_issue TEXT,
  allergies TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  symptoms JSONB DEFAULT '[]',
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  location_latitude DOUBLE PRECISION NOT NULL,
  location_longitude DOUBLE PRECISION NOT NULL,
  location_address TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved', 'referred')),
  assigned_to UUID REFERENCES users(id),
  medical_notes JSONB DEFAULT '[]',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medical_cases_status ON medical_cases(status);
CREATE INDEX IF NOT EXISTS idx_medical_cases_created_at ON medical_cases(created_at DESC);

-- QR registrations table
CREATE TABLE IF NOT EXISTS qr_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id VARCHAR(255) NOT NULL,
  entry_point VARCHAR(50) NOT NULL CHECK (entry_point IN ('railway_station', 'bus_stand', 'parking_area', 'other')),
  entry_point_name VARCHAR(255) NOT NULL,
  registered_by TEXT,  -- UUID or 'demo-xxx' for demo users
  group_size INTEGER NOT NULL CHECK (group_size >= 1 AND group_size <= 50),
  luggage_count INTEGER NOT NULL CHECK (luggage_count >= 1 AND luggage_count <= 20),
  intended_destination VARCHAR(50) NOT NULL CHECK (intended_destination IN ('Tapovan', 'Panchvati', 'Trambak', 'Ramkund', 'Kalaram', 'Sita Gufa', 'Other')),
  custom_destination TEXT,
  group_selfie TEXT NOT NULL,
  location_latitude DOUBLE PRECISION NOT NULL,
  location_longitude DOUBLE PRECISION NOT NULL,
  location_address TEXT DEFAULT '',
  contact_phone VARCHAR(50) NOT NULL,
  contact_name TEXT DEFAULT '',
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_registrations_qr_code ON qr_registrations(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_registrations_destination ON qr_registrations(intended_destination);
CREATE INDEX IF NOT EXISTS idx_qr_registrations_registered_at ON qr_registrations(registered_at DESC);

-- Lost & Found table
CREATE TABLE IF NOT EXISTS lost_found (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('lost', 'found')),
  reported_by TEXT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  location_latitude DOUBLE PRECISION NOT NULL,
  location_longitude DOUBLE PRECISION NOT NULL,
  location_address TEXT DEFAULT '',
  contact_phone VARCHAR(50) NOT NULL,
  contact_email TEXT DEFAULT '',
  images JSONB DEFAULT '[]',
  is_person BOOLEAN DEFAULT false,
  facial_recognition_data TEXT,
  matched_with_qr_registration UUID REFERENCES qr_registrations(id),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'matched', 'resolved', 'closed')),
  matched_with UUID REFERENCES lost_found(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lost_found_type ON lost_found(type);
CREATE INDEX IF NOT EXISTS idx_lost_found_status ON lost_found(status);
CREATE INDEX IF NOT EXISTS idx_lost_found_created_at ON lost_found(created_at DESC);
