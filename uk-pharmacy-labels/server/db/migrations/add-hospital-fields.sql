-- Add postcode and telephone columns to the hospitals table if they don't exist
-- Using PRAGMA to check if columns already exist before attempting to add
PRAGMA foreign_keys=off;

BEGIN TRANSACTION;

-- Check if postcode column exists
SELECT CASE 
    WHEN COUNT(*) = 0 THEN
        -- Column doesn't exist, add it
        'ALTER TABLE hospitals ADD COLUMN postcode TEXT;'
    ELSE
        -- Column exists, do nothing (SQLite requires some statement)
        'SELECT 1;'
END AS sql_to_run
FROM pragma_table_info('hospitals') 
WHERE name = 'postcode';

-- Check if phone column exists (using phone instead of telephone for consistency)
SELECT CASE 
    WHEN COUNT(*) = 0 THEN
        -- Column doesn't exist, add it
        'ALTER TABLE hospitals ADD COLUMN phone TEXT;'
    ELSE
        -- Column exists, do nothing
        'SELECT 1;'
END AS sql_to_run
FROM pragma_table_info('hospitals') 
WHERE name = 'phone';

-- Update the existing hospitals with default values if needed
UPDATE hospitals SET postcode = 'Unknown' WHERE postcode IS NULL;
UPDATE hospitals SET phone = 'Not provided' WHERE phone IS NULL;

COMMIT;

PRAGMA foreign_keys=on;
