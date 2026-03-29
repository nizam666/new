/*
  # Allow Directors and Managers to Insert Records

  1. Relax RLS INSERT policies on production_records and eb_reports
     so that users with 'manager' or 'director' roles can also insert records.
*/

-- Fix production_records INSERT policy
DROP POLICY IF EXISTS "Crusher managers can create production records" ON production_records;

CREATE POLICY "Crusher managers and directors can create production records"
  ON production_records FOR INSERT
  TO authenticated
  WITH CHECK (
    manager_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('crusher_manager', 'manager', 'director')
    )
  );

-- Fix eb_reports INSERT policy 
DROP POLICY IF EXISTS "Crusher managers can create EB reports" ON eb_reports;

CREATE POLICY "Crusher managers and directors can create EB reports"
  ON eb_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('crusher_manager', 'manager', 'director')
    )
  );
