-- UK Pharmacy System Database Schema
-- For NHS intranet deployment

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  access_levels JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create login attempts table for security monitoring
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  success BOOLEAN,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create system settings table
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(50) UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);

-- Create audit log table
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50),
  details JSONB,
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial system settings
INSERT INTO system_settings 
  (setting_key, setting_value, description)
VALUES
  ('session_timeout', '30', 'Session timeout in minutes'),
  ('password_expiry', '90', 'Password expiry in days'),
  ('system_name', 'NHS Pharmacy Label Generator', 'System name display text'),
  ('min_password_length', '8', 'Minimum password length'),
  ('password_requires_uppercase', 'true', 'Password must contain uppercase letters'),
  ('password_requires_number', 'true', 'Password must contain numbers'),
  ('password_requires_special', 'true', 'Password must contain special characters'),
  ('failed_login_lockout', '5', 'Account lockout after this many failed attempts');

-- Create function to update the "updated_at" column
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create triggers to automatically update timestamps
CREATE TRIGGER update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_settings_timestamp
BEFORE UPDATE ON system_settings
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
