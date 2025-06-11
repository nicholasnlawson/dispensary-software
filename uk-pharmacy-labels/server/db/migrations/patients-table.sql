-- Patient Data Table with encrypted field support
-- This table stores patient information with fields designed to accommodate encrypted data

CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nhsNumber TEXT,              -- Encrypted
    patientName TEXT,            -- Encrypted
    dateOfBirth TEXT,            -- Encrypted
    address TEXT,                -- Encrypted
    postcode TEXT,               -- Encrypted
    medicationDetails TEXT,      -- Encrypted (can store JSON strings with medication details)
    ward TEXT,
    consultantName TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    isActive BOOLEAN DEFAULT TRUE
);

-- Index for performance (non-encrypted fields)
CREATE INDEX IF NOT EXISTS idx_patients_ward ON patients (ward);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients (isActive);

-- Trigger to update the updatedAt timestamp
CREATE TRIGGER IF NOT EXISTS update_patient_timestamp 
AFTER UPDATE ON patients
BEGIN
    UPDATE patients SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
