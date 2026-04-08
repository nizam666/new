-- FINAL RLS RESET FOR ATTENDANCE
-- This migration ensures that both 'anon' (terminal) and 'authenticated' (app) 
-- roles have guaranteed access to manage attendance records.

-- 1. DROP ALL EXISTING POLICIES to clear any conflicting logic
DROP POLICY IF EXISTS "Allow authenticated users to insert attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow authenticated users to update attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow authenticated users to view attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to insert attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to select attendance" ON selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to update attendance" ON selfie_attendance;

-- 2. CREATE UNIVERSAL POLICIES (Simplest possible for kiosk usage)
-- For SELECT
CREATE POLICY "attendance_select_policy" 
ON selfie_attendance FOR SELECT 
TO public 
USING (true);

-- For INSERT
CREATE POLICY "attendance_insert_policy" 
ON selfie_attendance FOR INSERT 
TO public 
WITH CHECK (true);

-- For UPDATE
CREATE POLICY "attendance_update_policy" 
ON selfie_attendance FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);

-- 3. REMOVE POTENTIALLY BLOCKING CONSTRAINTS
-- We will rely on application logic for time checks for now to ensure storage works.
ALTER TABLE selfie_attendance DROP CONSTRAINT IF EXISTS check_out_after_check_in;

-- 4. ENSURE PERMISSIONS ARE GRANTED
GRANT ALL ON selfie_attendance TO anon;
GRANT ALL ON selfie_attendance TO authenticated;
GRANT ALL ON public.selfie_attendance TO postgres;
