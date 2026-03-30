/*
  # Fix EB Reports RLS for Crusher Managers

  1. Issue: Crusher managers (like emp010) could only see their OWN past EB reports, 
     causing the "starting reading" to show as 0 if the previous shift was done by someone else.
  2. Fix: Update the RLS policy to allow crusher managers to view all EB reports.
*/

DROP POLICY IF EXISTS "Manage EB reports" ON eb_reports;

CREATE POLICY "Manage EB reports"
  ON eb_reports FOR ALL
  TO authenticated
  USING (
    (user_id = (select auth.uid())) OR
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) AND u.role IN ('crusher_manager', 'manager', 'director')
    )
  )
  WITH CHECK (
    (user_id = (select auth.uid())) OR
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) AND u.role IN ('crusher_manager', 'manager', 'director')
    )
  );
