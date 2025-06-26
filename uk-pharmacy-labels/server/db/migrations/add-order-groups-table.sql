-- Add order_groups table
CREATE TABLE IF NOT EXISTS order_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_number TEXT NOT NULL,
    notes TEXT,
    timestamp TEXT NOT NULL
);

-- Add group_id column to orders table
ALTER TABLE orders ADD COLUMN group_id INTEGER;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_group_id ON orders(group_id);
CREATE INDEX IF NOT EXISTS idx_order_groups_group_number ON order_groups(group_number);
