-- Sever the relationship to the customers table
ALTER TABLE customer_vehicles DROP CONSTRAINT IF EXISTS customer_vehicles_customer_id_fkey;
ALTER TABLE customer_vehicles DROP COLUMN IF EXISTS customer_id;

-- Add standalone identity fields
ALTER TABLE customer_vehicles ADD COLUMN owner_name text NOT NULL DEFAULT '';
ALTER TABLE customer_vehicles ADD COLUMN owner_contact text;
