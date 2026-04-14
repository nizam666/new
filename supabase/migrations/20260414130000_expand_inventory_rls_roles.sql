-- Expand Inventory RLS policies to include chairmen and crusher_manager
-- This fixes the 42501 error during Inventory Procurement

-- 1. Update inventory_items policy
DROP POLICY IF EXISTS "Manage inventory items" ON inventory_items;
CREATE POLICY "Manage inventory items"
  ON inventory_items FOR ALL
  TO authenticated
  USING (
    (current_setting('request.method', true) = 'GET') OR
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) 
       AND u.role IN ('manager', 'director', 'crusher_manager', 'chairmen')
    )
  )
  WITH CHECK (
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) 
       AND u.role IN ('manager', 'director', 'crusher_manager', 'chairmen')
    )
  );

-- 2. Update inventory_transactions policy
DROP POLICY IF EXISTS "Manage inventory transactions" ON inventory_transactions;
CREATE POLICY "Manage inventory transactions"
  ON inventory_transactions FOR ALL
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) 
       AND u.role IN ('manager', 'director', 'crusher_manager', 'chairmen')
    )
  )
  WITH CHECK (
    user_id = (select auth.uid()) OR
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) 
       AND u.role IN ('manager', 'director', 'crusher_manager', 'chairmen')
    )
  );

-- 3. Update accounts policy
DROP POLICY IF EXISTS "Manage accounts" ON accounts;
CREATE POLICY "Manage accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) 
       AND u.role IN ('sales', 'director', 'manager', 'crusher_manager', 'chairmen')
    ) OR
    (current_setting('request.method', true) = 'GET')
  )
  WITH CHECK (
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) 
       AND u.role IN ('sales', 'director', 'manager', 'crusher_manager', 'chairmen')
    )
  );

-- 4. Update inventory_dispatch policy
DROP POLICY IF EXISTS "Managers can update dispatches" ON inventory_dispatch;
CREATE POLICY "Manage inventory dispatches"
  ON inventory_dispatch FOR ALL
  TO authenticated
  USING (
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) 
       AND u.role IN ('manager', 'director', 'crusher_manager', 'chairmen')
    ) OR
    (current_setting('request.method', true) = 'GET')
  )
  WITH CHECK (
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) 
       AND u.role IN ('manager', 'director', 'crusher_manager', 'chairmen')
    )
  );
