-- NUCLEAR RLS FIX: Universal access for all authenticated users
-- This migration removes every complex role-based condition to guarantee that 
-- NO logged-in user is blocked from dispatching tickets.

DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- 1. Purge ALL policies on invoices
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'invoices' AND schemaname = 'public') LOOP
        EXECUTE format('DROP     POLICY IF EXISTS %I ON public.invoices', pol.policyname);
    END LOOP;

    -- 2. Purge ALL policies on customers
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'customers' AND schemaname = 'public') LOOP
        EXECUTE format('DROP     POLICY IF EXISTS %I ON public.customers', pol.policyname);
    END LOOP;
END $$;

-- 3. Grant absolute 'Authenticated' management for Invoices
CREATE POLICY "Universal Invoice Management"
  ON invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Grant absolute 'Authenticated' management for Customers
CREATE POLICY "Universal Customer Management"
  ON customers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Ensure global read access for Materials (Price Master)
DROP POLICY IF EXISTS "Anyone authenticated can view material investors" ON material_investors;
CREATE POLICY "Anyone authenticated can view material investors"
  ON material_investors FOR SELECT
  TO authenticated
  USING (true);
