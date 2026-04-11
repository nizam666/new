-- Robust RLS Fix for Invoices & Customers
-- This migration forcefully clears ALL existing policies on these tables to prevent legacy conflicts
-- and initializes a single, comprehensive policy for all authorized system roles.

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- 1. Drop ALL existing policies on 'invoices'
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'invoices' AND schemaname = 'public') LOOP
        EXECUTE format('DROP     POLICY IF EXISTS %I ON public.invoices', pol.policyname);
    END LOOP;

    -- 2. Drop ALL existing policies on 'customers'
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'customers' AND schemaname = 'public') LOOP
        EXECUTE format('DROP     POLICY IF EXISTS %I ON public.customers', pol.policyname);
    END LOOP;
END $$;

-- Enable RLS just in case it was disabled (it should be on)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 3. Create Unified 'Manage Invoices' Policy
-- Includes ALL defined system roles from users_role_check
CREATE POLICY "Manage invoices universal"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) 
      AND u.role IN ('contractor', 'crusher_manager', 'manager', 'sales', 'director', 'worker', 'workers', 'quarry_worker', 'crusher_worker', 'chairmen')
    ) OR 
    (current_setting('request.method', true) = 'GET')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) 
      AND u.role IN ('contractor', 'crusher_manager', 'manager', 'sales', 'director', 'worker', 'workers', 'quarry_worker', 'crusher_worker', 'chairmen')
    )
  );

-- 4. Create Unified 'Manage Customers' Policy
-- Allows operational roles to update profiles (required for Smart Delivery site saving)
CREATE POLICY "Manage customers universal"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) 
      AND u.role IN ('contractor', 'crusher_manager', 'manager', 'sales', 'director', 'worker', 'workers', 'quarry_worker', 'crusher_worker', 'chairmen')
    ) OR 
    (current_setting('request.method', true) = 'GET')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) 
      AND u.role IN ('contractor', 'crusher_manager', 'manager', 'sales', 'director', 'worker', 'workers', 'quarry_worker', 'crusher_worker', 'chairmen')
    )
  );

-- 5. Add View access for all authenticated users to price master (material investors) 
-- to ensure buttons work for everyone
DROP POLICY IF EXISTS "Anyone authenticated can view material investors" ON material_investors;
CREATE POLICY "Anyone authenticated can view material investors"
  ON material_investors FOR SELECT
  TO authenticated
  USING (true);
