-- Repair Attendance Schema and RLS
-- This migration ensures the table structure matches the application logic and RLS policies are truly open.

-- 1. Ensure work_area column exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'selfie_attendance' AND column_name = 'work_area') THEN
    ALTER TABLE selfie_attendance ADD COLUMN work_area text DEFAULT 'general';
  END IF;
END $$;

-- 2. Drop all previous policies to start clean
DROP POLICY IF EXISTS "attendance_select_policy" ON selfie_attendance;
DROP POLICY IF EXISTS "attendance_insert_policy" ON selfie_attendance;
DROP POLICY IF EXISTS "attendance_update_policy" ON selfie_attendance;
DROP POLICY IF EXISTS "attendance_photos_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "attendance_photos_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to insert attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow authenticated users to update attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow authenticated users to view attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to insert attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to select attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to update attendance" ON selfie_attendance;

-- 3. Create explicit policies for both roles
-- SELECT
CREATE POLICY "attendance_select_policy_anon" ON selfie_attendance FOR SELECT TO anon USING (true);
CREATE POLICY "attendance_select_policy_auth" ON selfie_attendance FOR SELECT TO authenticated USING (true);

-- INSERT
CREATE POLICY "attendance_insert_policy_anon" ON selfie_attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "attendance_insert_policy_auth" ON selfie_attendance FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE
CREATE POLICY "attendance_update_policy_anon" ON selfie_attendance FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "attendance_update_policy_auth" ON selfie_attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Grant full table permissions
GRANT ALL ON selfie_attendance TO anon;
GRANT ALL ON selfie_attendance TO authenticated;
GRANT ALL ON selfie_attendance TO public;

-- 5. Storage policies for attendance-photos
CREATE POLICY "storage_select_policy_anon" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'attendance-photos');
CREATE POLICY "storage_select_policy_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attendance-photos');
CREATE POLICY "storage_insert_policy_anon" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'attendance-photos');
CREATE POLICY "storage_insert_policy_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attendance-photos');

-- 6. Final constraint check
ALTER TABLE selfie_attendance DROP CONSTRAINT IF EXISTS check_out_after_check_in;
ALTER TABLE selfie_attendance DROP CONSTRAINT IF EXISTS unique_employee_daily_attendance;
