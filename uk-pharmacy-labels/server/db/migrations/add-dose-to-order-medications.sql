-- Add dose column to order_medications table
-- This migration adds a dose field to store medication dosage information

-- Note: The migration framework should handle duplicate column errors gracefully
-- since SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN

ALTER TABLE order_medications ADD COLUMN dose TEXT;
