/*
  # Fix Self-Service Attendance RLS Policies

  1. Ensure anonymous and authenticated access for self-service attendance terminal.
  2. Allow insert/select/update for self-service attendance records.
 3. Keep RLS enabled on selfie_attendance.
*/

-- Ensure row level security is enabled
ALTER TABLE IF EXISTS selfie_attendance ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts from kiosk terminal
DROP POLICY IF EXISTS "Allow anon to insert attendance" ON selfie_attendance;
CREATE POLICY "Allow anon to insert attendance"
  ON selfie_attendance FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous selects from kiosk terminal
DROP POLICY IF EXISTS "Allow anon to select attendance" ON selfie_attendance;
CREATE POLICY "Allow anon to select attendance"
  ON selfie_attendance FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous updates from kiosk terminal
DROP POLICY IF EXISTS "Allow anon to update attendance" ON selfie_attendance;
CREATE POLICY "Allow anon to update attendance"
  ON selfie_attendance FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Ensure authenticated users can also use the terminal
DROP POLICY IF EXISTS "Allow authenticated users to insert attendance" ON selfie_attendance;
CREATE POLICY "Allow authenticated users to insert attendance"
  ON selfie_attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to select attendance" ON selfie_attendance;
CREATE POLICY "Allow authenticated users to view attendance"
  ON selfie_attendance FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update attendance" ON selfie_attendance;
CREATE POLICY "Allow authenticated users to update attendance"
  ON selfie_attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
