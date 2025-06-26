-- Migration: Add 'in-progress' and 'unfulfilled' statuses to orders.status CHECK constraint
-- Created: 2025-06-26
-- Author: Cascade AI

-- SQLite does not allow MODIFYING an existing CHECK constraint directly.
-- Therefore we recreate the table with the updated constraint, copy data,
-- then replace the old table.

PRAGMA foreign_keys = off;
BEGIN TRANSACTION;

-- 1. Create a new table with the updated CHECK constraint
CREATE TABLE IF NOT EXISTS orders_new (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('patient', 'ward-stock')),
  ward_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'processing', 'unfulfilled', 'completed', 'cancelled')),
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  notes TEXT,
  processed_by TEXT,
  processed_at TEXT,
  checked_by TEXT,
  processing_notes TEXT,
  FOREIGN KEY (ward_id) REFERENCES wards(id)
);

-- 2. Copy data from old table into new table
INSERT INTO orders_new (
  id, type, ward_id, timestamp, status, requester_name, requester_role,
  notes, processed_by, processed_at, checked_by, processing_notes
)
SELECT 
  id, type, ward_id, timestamp, status, requester_name, requester_role,
  notes, processed_by, processed_at, checked_by, processing_notes
FROM orders;

-- 3. Drop the old orders table
DROP TABLE orders;

-- 4. Rename the new table to orders
ALTER TABLE orders_new RENAME TO orders;

COMMIT;
PRAGMA foreign_keys = on;
