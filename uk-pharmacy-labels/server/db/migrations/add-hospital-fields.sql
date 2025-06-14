-- Add postcode and telephone columns to the hospitals table
ALTER TABLE hospitals ADD COLUMN postcode TEXT;
ALTER TABLE hospitals ADD COLUMN telephone TEXT;

-- Update the existing hospitals with default values if needed
UPDATE hospitals SET postcode = 'Unknown' WHERE postcode IS NULL;
UPDATE hospitals SET telephone = 'Not provided' WHERE telephone IS NULL;
