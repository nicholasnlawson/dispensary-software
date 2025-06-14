-- Add order history/audit trail table
-- This tracks all changes to orders including status changes, medication modifications, etc.

-- Create order_history table for audit trail
CREATE TABLE IF NOT EXISTS order_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    action_type TEXT NOT NULL,  -- 'status_change', 'medication_add', 'medication_remove', 'medication_update', etc.
    action_timestamp TEXT NOT NULL,
    modified_by TEXT NOT NULL,  -- User ID or name who made the change
    reason TEXT,                -- Reason for the change
    previous_data TEXT,         -- JSON string of previous state (if applicable)
    new_data TEXT,              -- JSON string of new state (if applicable)
    metadata TEXT,              -- Additional metadata in JSON format
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Create index for faster lookups on order_id
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
