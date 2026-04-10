-- Repair material_investors schema for Price Master workflow
-- This ensures the table exists and legacy fields are nullable

CREATE TABLE IF NOT EXISTS material_investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_name text,
  contact_number text,
  email text,
  investment_amount numeric DEFAULT 0,
  material_type text,
  investment_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Ensure legacy fields are nullable if table already exists
ALTER TABLE material_investors ALTER COLUMN investor_name DROP NOT NULL;
ALTER TABLE material_investors ALTER COLUMN contact_number DROP NOT NULL;
ALTER TABLE material_investors ALTER COLUMN material_type DROP NOT NULL;
ALTER TABLE material_investors ALTER COLUMN investment_amount DROP DEFAULT;
ALTER TABLE material_investors ALTER COLUMN investment_amount SET DEFAULT 0;

-- Add new standardize columns for Price Master if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'material_investors' AND COLUMN_NAME = 'product_type') THEN
        ALTER TABLE material_investors ADD COLUMN product_type text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'material_investors' AND COLUMN_NAME = 'sales_price') THEN
        ALTER TABLE material_investors ADD COLUMN sales_price numeric;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'material_investors' AND COLUMN_NAME = 'is_tax_inclusive') THEN
        ALTER TABLE material_investors ADD COLUMN is_tax_inclusive boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'material_investors' AND COLUMN_NAME = 'gst_rate') THEN
        ALTER TABLE material_investors ADD COLUMN gst_rate numeric DEFAULT 5;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'material_investors' AND COLUMN_NAME = 'hsn') THEN
        ALTER TABLE material_investors ADD COLUMN hsn text;
    END IF;
END $$;

-- Enable RLS and add basic policy if not already present
ALTER TABLE material_investors ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'material_investors' AND policyname = 'Public Access for Authenticated') THEN
        CREATE POLICY "Public Access for Authenticated" ON material_investors
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
