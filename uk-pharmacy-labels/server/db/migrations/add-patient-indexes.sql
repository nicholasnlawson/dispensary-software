-- Add indexes for patient identifiers to improve medication reorder checking
-- This migration adds indexes for patient_nhs and patient_hospital_id to speed up lookups

-- Add index for patient hospital ID (primary identifier for patients)
CREATE INDEX IF NOT EXISTS idx_patients_hospital_id ON order_patients(patient_hospital_id);

-- Add index for NHS number
CREATE INDEX IF NOT EXISTS idx_patients_nhs ON order_patients(patient_nhs);

-- Add index on orders timestamp for faster date filtering
CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp);

-- Add index on order_medications name for faster medication lookups
CREATE INDEX IF NOT EXISTS idx_medications_name ON order_medications(name);
