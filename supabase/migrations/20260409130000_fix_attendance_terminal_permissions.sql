-- Fix permissions for Attendance Terminal
-- This migration ensures the RPC function and storage bucket are accessible to both anon and authenticated users.

-- 1. Grant execute on the verification function
GRANT EXECUTE ON FUNCTION verify_employee_id(text) TO public;
GRANT EXECUTE ON FUNCTION verify_employee_id(text) TO anon;
GRANT EXECUTE ON FUNCTION verify_employee_id(text) TO authenticated;

-- 2. Consolidate and fix storage policies for attendance-photos
-- First remove existing to avoid conflicts
DROP POLICY IF EXISTS "Allow public viewing of attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads to attendance photos" ON storage.objects;

-- Create universal policies
CREATE POLICY "attendance_photos_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'attendance-photos');

CREATE POLICY "attendance_photos_insert_policy"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'attendance-photos');

-- 3. Ensure bucket is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
