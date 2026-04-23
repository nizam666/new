-- Expand RLS Policies for Attendance Tables
-- Allow crusher_manager role to view records in addition to manager and director.

-- 1. Manual Attendance (attendance table)
DROP POLICY IF EXISTS "Users and managers can view attendance" ON attendance;
CREATE POLICY "Users and managers can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role IN ('manager', 'director', 'crusher_manager')
    )
  );

-- 2. Group Attendance (attendance_records table)
DROP POLICY IF EXISTS "Manage attendance records" ON attendance_records;
CREATE POLICY "Manage attendance records"
  ON attendance_records FOR ALL
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) AND u.role IN ('manager', 'director', 'crusher_manager')
    )
  )
  WITH CHECK (
    user_id = (select auth.uid()) OR
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) AND u.role IN ('manager', 'director', 'crusher_manager')
    )
  );
