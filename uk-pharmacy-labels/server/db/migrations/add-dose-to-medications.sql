-- Add dose column to order_medications table
-- This migration adds a dose field to store medication dosage information

-- Check if dose column exists, if not add it (makes migration idempotent)
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- Create a temporary table with the structure we want
CREATE TABLE IF NOT EXISTS temp_order_medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  name TEXT NOT NULL,
  form TEXT,
  strength TEXT,
  quantity TEXT NOT NULL,
  notes TEXT,
  dose TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Insert data from the existing table
INSERT INTO temp_order_medications(id, order_id, name, form, strength, quantity, notes, dose)
SELECT id, order_id, name, form, strength, quantity, notes, 
       CASE WHEN EXISTS(SELECT 1 FROM pragma_table_info('order_medications') WHERE name='dose') 
            THEN dose ELSE NULL END
FROM order_medications;

-- Drop the old table
DROP TABLE IF EXISTS order_medications;

-- Rename the new table to the original name
ALTER TABLE temp_order_medications RENAME TO order_medications;

COMMIT;
PRAGMA foreign_keys=on;
