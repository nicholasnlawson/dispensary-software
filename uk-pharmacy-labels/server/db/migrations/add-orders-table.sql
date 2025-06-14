-- Add orders table migration
-- This migration creates the orders table structure for storing medication orders

-- Orders table for both patient and ward stock orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('patient', 'ward-stock')),
  ward_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  notes TEXT,
  processed_by TEXT,
  processed_at TEXT,
  checked_by TEXT,
  processing_notes TEXT,
  FOREIGN KEY (ward_id) REFERENCES wards(id)
);

-- Patient table for storing patient-specific order details
CREATE TABLE IF NOT EXISTS order_patients (
  order_id TEXT PRIMARY KEY,
  patient_name TEXT NOT NULL,
  patient_dob TEXT,
  patient_nhs TEXT,
  patient_hospital_id TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Medications table for storing medications in orders
CREATE TABLE IF NOT EXISTS order_medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  name TEXT NOT NULL,
  form TEXT,
  strength TEXT,
  quantity TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
