-- Migration to add first name and surname fields to users table
-- This ensures GDPR compliance by capturing full user identity

-- Add first_name and surname columns to users table 
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN surname TEXT;

-- Update any existing users to have empty name fields
-- This ensures no NULL values which could cause issues with the application
UPDATE users SET first_name = '' WHERE first_name IS NULL;
UPDATE users SET surname = '' WHERE surname IS NULL;
