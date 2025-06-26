-- Migration: Add group_id column back to orders table (lost during table recreation)
-- Created: 2025-06-26
-- Author: Cascade AI

-- SQLite supports simple ADD COLUMN without specifying foreign key constraint
-- We will also recreate the index that existed previously.

BEGIN TRANSACTION;

-- Add group_id column to orders table to reference order_groups
ALTER TABLE orders ADD COLUMN group_id INTEGER;

-- Re-create index for faster lookups by group_id
CREATE INDEX IF NOT EXISTS idx_orders_group_id ON orders(group_id);

COMMIT;
