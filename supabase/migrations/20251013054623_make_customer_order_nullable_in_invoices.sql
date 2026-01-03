/*
  # Make customer_id and order_id nullable in invoices

  1. Changes
    - Make customer_id column nullable
    - Make order_id column nullable
    
  2. Purpose
    - Allow invoices to be created without linking to customer or order tables
    - Use customer_name field directly for simpler invoice management
*/

-- Make customer_id nullable
ALTER TABLE invoices ALTER COLUMN customer_id DROP NOT NULL;

-- Make order_id nullable
ALTER TABLE invoices ALTER COLUMN order_id DROP NOT NULL;
