-- Migration to add first name and surname fields to users table
-- This ensures GDPR compliance by capturing full user identity
-- Made idempotent to prevent errors on repeated runs

PRAGMA foreign_keys=off;

BEGIN TRANSACTION;

-- Check if first_name column exists before adding
SELECT CASE 
    WHEN COUNT(*) = 0 THEN
        -- Column doesn't exist, add it
        'ALTER TABLE users ADD COLUMN first_name TEXT;'
    ELSE
        -- Column exists, do nothing
        'SELECT 1;'
END AS sql_to_run
FROM pragma_table_info('users') 
WHERE name = 'first_name';

-- Check if surname column exists before adding
SELECT CASE 
    WHEN COUNT(*) = 0 THEN
        -- Column doesn't exist, add it
        'ALTER TABLE users ADD COLUMN surname TEXT;'
    ELSE
        -- Column exists, do nothing
        'SELECT 1;'
END AS sql_to_run
FROM pragma_table_info('users') 
WHERE name = 'surname';

-- Update any existing users to have empty name fields
-- This ensures no NULL values which could cause issues with the application
UPDATE users SET first_name = '' WHERE first_name IS NULL;
UPDATE users SET surname = '' WHERE surname IS NULL;

COMMIT;

PRAGMA foreign_keys=on;
