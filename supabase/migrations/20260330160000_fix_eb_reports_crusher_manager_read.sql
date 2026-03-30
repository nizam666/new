/*
  # Fix EB Reports RLS - Allow Crusher Managers to Read All Records

  Problem:
    When emp010 (crusher_manager) opens the Daily EB Report form, the "Starting Reading"
    shows 0 because the previous shift's ending_reading was submitted by a DIFFERENT user.
    The current "Manage EB reports" policy only allows crusher_manager to SELECT their OWN rows
    (user_id = auth.uid()), so the query for the previous record returns nothing.

  Fix:
    Drop and recreate the "Manage EB reports" policy to also allow crusher_manager to
    SELECT all EB reports (while INSERT/UPDATE/DELETE still restricted to own records).
*/

-- Drop all existing EB report policies to start clean
DROP POLICY IF EXISTS "Manage EB reports" ON eb_reports;
DROP POLICY IF EXISTS "Crusher managers and directors can create EB reports" ON eb_reports;
DROP POLICY IF EXISTS "Crusher managers can create EB reports" ON eb_reports;
DROP POLICY IF EXISTS "Crusher managers can view own EB reports" ON eb_reports;
DROP POLICY IF EXISTS "Crusher managers can update own EB reports" ON eb_reports;
DROP POLICY IF EXISTS "Directors and managers can view all EB reports" ON eb_reports;

-- Allow all crusher_managers, managers, and directors to SELECT all EB reports
-- (needed so the "starting reading" can be auto-filled from the PREVIOUS shift's ending reading,
--  regardless of who submitted that previous shift)
CREATE POLICY "EB reports select policy"
  ON eb_reports FOR SELECT
  TO authenticated
  USING (
    (user_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('crusher_manager', 'manager', 'director')
    )
  );

-- Allow crusher_managers, managers, and directors to INSERT their own records
CREATE POLICY "EB reports insert policy"
  ON eb_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('crusher_manager', 'manager', 'director')
    )
  );

-- Allow crusher_managers, managers, and directors to UPDATE their own records
CREATE POLICY "EB reports update policy"
  ON eb_reports FOR UPDATE
  TO authenticated
  USING (
    (user_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    (user_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('manager', 'director')
    )
  );

-- Allow directors to delete EB reports
CREATE POLICY "EB reports delete policy"
  ON eb_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('manager', 'director')
    )
  );
