-- Fix RLS violations for Weighbridge Dispatch tickets and Customer Profile synchronization
-- This expands the 'invoices' and 'customers' policies to the roles performing dispatch operations

-- 1. Update Invoices Policy
DROP     POLICY IF EXISTS "Manage invoices" ON invoices;

CREATE POLICY "Manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) AND u.role IN ('sales', 'manager', 'director', 'crusher_manager', 'contractor')
    ) OR 
    (current_setting('request.method', true) = 'GET')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) AND u.role IN ('sales', 'manager', 'director', 'crusher_manager', 'contractor')
    )
  );

-- 2. Update Customers Management Policy
DROP POLICY IF EXISTS "Sales can manage customers" ON customers;

CREATE POLICY "Sales can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) AND u.role IN ('sales', 'manager', 'director', 'crusher_manager', 'contractor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) AND u.role IN ('sales', 'manager', 'director', 'crusher_manager', 'contractor')
    )
  );
