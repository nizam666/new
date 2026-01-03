/*
  # Fix Security and Performance Issues

  ## Overview
  This migration addresses security and performance issues identified in the database:
  1. Adds missing indexes on foreign keys for optimal query performance
  2. Optimizes RLS policies to use SELECT subqueries for auth functions
  3. Consolidates multiple permissive policies into single policies where appropriate

  ## 1. Add Missing Foreign Key Indexes

  ### New Indexes Added
  - `idx_approval_workflows_submitted_by` on approval_workflows(submitted_by)
  - `idx_invoices_order_id` on invoices(order_id)
  - `idx_machine_maintenance_equipment_id` on machine_maintenance(equipment_id)
  - `idx_machine_maintenance_performed_by` on machine_maintenance(performed_by)
  - `idx_media_uploads_user_id` on media_uploads(user_id)
  - `idx_production_records_crusher_id` on production_records(crusher_id)
  - `idx_quotation_items_quotation_id` on quotation_items(quotation_id)
  - `idx_sales_orders_quotation_id` on sales_orders(quotation_id)
  - `idx_sales_orders_sales_person_id` on sales_orders(sales_person_id)

  ## 2. Optimize RLS Policies

  All RLS policies updated to use `(select auth.uid())` instead of `auth.uid()` to prevent
  re-evaluation on each row, significantly improving query performance at scale.

  ## 3. Consolidate Multiple Permissive Policies

  Multiple permissive policies for the same action consolidated into single policies with
  OR conditions to improve policy evaluation performance.

  ## Important Notes
  - All existing policies are dropped and recreated with optimizations
  - No data is modified, only policy logic is optimized
  - Performance improvements will be noticeable as data scales
*/

-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Directors can view all users" ON users;
DROP POLICY IF EXISTS "Managers can view department users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

DROP POLICY IF EXISTS "Authenticated users can view equipment" ON equipment;
DROP POLICY IF EXISTS "Managers and directors can manage equipment" ON equipment;

DROP POLICY IF EXISTS "Contractors can view own drilling records" ON drilling_records;
DROP POLICY IF EXISTS "Contractors can create drilling records" ON drilling_records;
DROP POLICY IF EXISTS "Contractors can update own drilling records" ON drilling_records;
DROP POLICY IF EXISTS "Managers can update drilling record status" ON drilling_records;

DROP POLICY IF EXISTS "Contractors can view own blasting records" ON blasting_records;
DROP POLICY IF EXISTS "Contractors can create blasting records" ON blasting_records;
DROP POLICY IF EXISTS "Contractors can update own blasting records" ON blasting_records;
DROP POLICY IF EXISTS "Managers can update blasting record status" ON blasting_records;

DROP POLICY IF EXISTS "Contractors can view own loading records" ON loading_records;
DROP POLICY IF EXISTS "Contractors can create loading records" ON loading_records;
DROP POLICY IF EXISTS "Contractors can update own loading records" ON loading_records;
DROP POLICY IF EXISTS "Managers can update loading record status" ON loading_records;

DROP POLICY IF EXISTS "Crusher managers can view own production records" ON production_records;
DROP POLICY IF EXISTS "Crusher managers can create production records" ON production_records;
DROP POLICY IF EXISTS "Crusher managers can update own production records" ON production_records;
DROP POLICY IF EXISTS "Managers can update production record status" ON production_records;

DROP POLICY IF EXISTS "Staff can view maintenance records" ON machine_maintenance;
DROP POLICY IF EXISTS "Crusher managers can create maintenance records" ON machine_maintenance;
DROP POLICY IF EXISTS "Managers can update maintenance records" ON machine_maintenance;

DROP POLICY IF EXISTS "Sales and management can view customers" ON customers;
DROP POLICY IF EXISTS "Sales can manage customers" ON customers;

DROP POLICY IF EXISTS "Sales can view quotations" ON quotations;
DROP POLICY IF EXISTS "Sales can create quotations" ON quotations;
DROP POLICY IF EXISTS "Sales can update own quotations" ON quotations;
DROP POLICY IF EXISTS "Managers can update quotation status" ON quotations;

DROP POLICY IF EXISTS "Users can view quotation items" ON quotation_items;
DROP POLICY IF EXISTS "Sales can manage quotation items" ON quotation_items;

DROP POLICY IF EXISTS "Sales can view orders" ON sales_orders;
DROP POLICY IF EXISTS "Sales can create orders" ON sales_orders;
DROP POLICY IF EXISTS "Sales can update own orders" ON sales_orders;
DROP POLICY IF EXISTS "Managers can update order status" ON sales_orders;

DROP POLICY IF EXISTS "Sales and management can view invoices" ON invoices;
DROP POLICY IF EXISTS "Sales and management can manage invoices" ON invoices;

DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can create own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON attendance;

DROP POLICY IF EXISTS "Users can view own media" ON media_uploads;
DROP POLICY IF EXISTS "Users can upload media" ON media_uploads;
DROP POLICY IF EXISTS "Users can delete own media" ON media_uploads;

DROP POLICY IF EXISTS "Users can view relevant approvals" ON approval_workflows;
DROP POLICY IF EXISTS "Users can create approval requests" ON approval_workflows;
DROP POLICY IF EXISTS "Approvers can update approvals" ON approval_workflows;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_approval_workflows_submitted_by ON approval_workflows(submitted_by);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_machine_maintenance_equipment_id ON machine_maintenance(equipment_id);
CREATE INDEX IF NOT EXISTS idx_machine_maintenance_performed_by ON machine_maintenance(performed_by);
CREATE INDEX IF NOT EXISTS idx_media_uploads_user_id ON media_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_production_records_crusher_id ON production_records(crusher_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_quotation_id ON sales_orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_sales_person_id ON sales_orders(sales_person_id);

-- Recreate optimized RLS policies for users table
CREATE POLICY "Users can view profiles"
  ON users FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = id OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid()) AND u.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Recreate optimized RLS policies for equipment table
CREATE POLICY "All authenticated users can view equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (
    true OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director', 'crusher_manager')
    )
  );

CREATE POLICY "Managers and directors can manage equipment"
  ON equipment FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director', 'crusher_manager')
    )
  );

-- Recreate optimized RLS policies for drilling_records
CREATE POLICY "Contractors and managers can view drilling records"
  ON drilling_records FOR SELECT
  TO authenticated
  USING (
    contractor_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Contractors can create drilling records"
  ON drilling_records FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'contractor'
    )
  );

CREATE POLICY "Contractors and managers can update drilling records"
  ON drilling_records FOR UPDATE
  TO authenticated
  USING (
    (contractor_id = (select auth.uid()) AND status = 'pending') OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    (contractor_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

-- Recreate optimized RLS policies for blasting_records
CREATE POLICY "Contractors and managers can view blasting records"
  ON blasting_records FOR SELECT
  TO authenticated
  USING (
    contractor_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Contractors can create blasting records"
  ON blasting_records FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'contractor'
    )
  );

CREATE POLICY "Contractors and managers can update blasting records"
  ON blasting_records FOR UPDATE
  TO authenticated
  USING (
    (contractor_id = (select auth.uid()) AND status = 'pending') OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    (contractor_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

-- Recreate optimized RLS policies for loading_records
CREATE POLICY "Contractors and managers can view loading records"
  ON loading_records FOR SELECT
  TO authenticated
  USING (
    contractor_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Contractors can create loading records"
  ON loading_records FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'contractor'
    )
  );

CREATE POLICY "Contractors and managers can update loading records"
  ON loading_records FOR UPDATE
  TO authenticated
  USING (
    (contractor_id = (select auth.uid()) AND status = 'pending') OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    (contractor_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

-- Recreate optimized RLS policies for production_records
CREATE POLICY "Crusher managers and directors can view production records"
  ON production_records FOR SELECT
  TO authenticated
  USING (
    manager_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Crusher managers can create production records"
  ON production_records FOR INSERT
  TO authenticated
  WITH CHECK (
    manager_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'crusher_manager'
    )
  );

CREATE POLICY "Crusher managers and directors can update production records"
  ON production_records FOR UPDATE
  TO authenticated
  USING (
    (manager_id = (select auth.uid()) AND status = 'pending') OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    (manager_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

-- Recreate optimized RLS policies for machine_maintenance
CREATE POLICY "Staff can view maintenance records"
  ON machine_maintenance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can create maintenance records"
  ON machine_maintenance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('crusher_manager', 'manager', 'director')
    )
  );

CREATE POLICY "Managers can update maintenance records"
  ON machine_maintenance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

-- Recreate optimized RLS policies for customers
CREATE POLICY "Sales and management can access customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('sales', 'manager', 'director')
    )
  );

-- Recreate optimized RLS policies for quotations
CREATE POLICY "Sales and management can view quotations"
  ON quotations FOR SELECT
  TO authenticated
  USING (
    sales_person_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Sales can create quotations"
  ON quotations FOR INSERT
  TO authenticated
  WITH CHECK (
    sales_person_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'sales'
    )
  );

CREATE POLICY "Sales and managers can update quotations"
  ON quotations FOR UPDATE
  TO authenticated
  USING (
    sales_person_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    sales_person_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

-- Recreate optimized RLS policies for quotation_items
CREATE POLICY "Users can view and manage quotation items"
  ON quotation_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotations
      WHERE quotations.id = quotation_items.quotation_id
      AND (
        quotations.sales_person_id = (select auth.uid()) OR
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
        )
      )
    )
  );

-- Recreate optimized RLS policies for sales_orders
CREATE POLICY "Sales and management can view orders"
  ON sales_orders FOR SELECT
  TO authenticated
  USING (
    sales_person_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Sales can create orders"
  ON sales_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    sales_person_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'sales'
    )
  );

CREATE POLICY "Sales and managers can update orders"
  ON sales_orders FOR UPDATE
  TO authenticated
  USING (
    sales_person_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    sales_person_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

-- Recreate optimized RLS policies for invoices
CREATE POLICY "Sales and management can access invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('sales', 'manager', 'director')
    )
  );

-- Recreate optimized RLS policies for attendance
CREATE POLICY "Users and managers can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can create own attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Recreate optimized RLS policies for media_uploads
CREATE POLICY "Users and managers can view media"
  ON media_uploads FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

CREATE POLICY "Users can upload media"
  ON media_uploads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own media"
  ON media_uploads FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Recreate optimized RLS policies for approval_workflows
CREATE POLICY "Users can view relevant approvals"
  ON approval_workflows FOR SELECT
  TO authenticated
  USING (
    submitted_by = (select auth.uid()) OR
    approver_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'director'
    )
  );

CREATE POLICY "Users can create approval requests"
  ON approval_workflows FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = (select auth.uid()));

CREATE POLICY "Approvers can update approvals"
  ON approval_workflows FOR UPDATE
  TO authenticated
  USING (
    approver_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director')
    )
  );

-- Recreate optimized RLS policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);