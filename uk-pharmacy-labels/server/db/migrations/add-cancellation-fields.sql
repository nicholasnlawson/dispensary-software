-- Add cancellation metadata fields to orders table
-- This migration adds columns to track who cancelled an order and why

-- Add cancelled_by, cancellation_reason, and cancelled_at columns to orders table
ALTER TABLE orders ADD COLUMN cancelled_by TEXT;
ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;

-- Create index for faster lookups of cancelled orders
CREATE INDEX IF NOT EXISTS idx_orders_cancelled ON orders(status, cancelled_at);
