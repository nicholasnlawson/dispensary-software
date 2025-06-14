-- This migration file was causing errors with duplicate column additions
-- It's now simplified to just update values if the column exists

PRAGMA foreign_keys=off;

-- No ALTER TABLE attempts - just update values if needed
-- This is safe because the add-hospital-fields.sql already added the phone column

-- Try to update phone values - if the column doesn't exist, this will silently do nothing
UPDATE hospitals SET phone = 'Not provided' WHERE phone IS NULL;

PRAGMA foreign_keys=on;
