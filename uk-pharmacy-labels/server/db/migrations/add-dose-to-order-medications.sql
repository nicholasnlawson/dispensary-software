-- Add dose column to order_medications table
-- This migration adds a dose field to store medication dosage information

ALTER TABLE order_medications ADD COLUMN dose TEXT;
