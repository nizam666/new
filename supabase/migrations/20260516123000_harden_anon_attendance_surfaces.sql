-- Lock down anonymous attendance and approval surfaces.
-- Attendance terminal writes should be handled by an authenticated session or a server-side flow.

-- Remove anonymous table access to attendance records.
DROP POLICY IF EXISTS "attendance_select_policy" ON public.selfie_attendance;
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.selfie_attendance;
DROP POLICY IF EXISTS "attendance_update_policy" ON public.selfie_attendance;
DROP POLICY IF EXISTS "attendance_select_policy_anon" ON public.selfie_attendance;
DROP POLICY IF EXISTS "attendance_insert_policy_anon" ON public.selfie_attendance;
DROP POLICY IF EXISTS "attendance_update_policy_anon" ON public.selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to insert attendance" ON public.selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to select attendance" ON public.selfie_attendance;
DROP POLICY IF EXISTS "Allow anon to update attendance" ON public.selfie_attendance;

REVOKE ALL ON TABLE public.selfie_attendance FROM anon;
REVOKE ALL ON TABLE public.selfie_attendance FROM public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.selfie_attendance TO authenticated;

-- Prevent anonymous callers from enumerating employee IDs through the terminal helper.
REVOKE EXECUTE ON FUNCTION public.verify_employee_id(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_employee_id(text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_employee_id(text) TO authenticated;

-- Remove anonymous approval/notification write and read access.
DROP POLICY IF EXISTS "anon_insert_approvals" ON public.approval_workflows;
DROP POLICY IF EXISTS "anon_select_approvals" ON public.approval_workflows;
DROP POLICY IF EXISTS "anon_insert_notifications" ON public.notifications;

REVOKE ALL ON TABLE public.approval_workflows FROM anon;
REVOKE ALL ON TABLE public.notifications FROM anon;

-- Attendance photos can contain biometric and location-correlated evidence.
-- Keep access private and require authenticated policies or signed URLs.
DROP POLICY IF EXISTS "Allow public viewing of attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon uploads to attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "attendance_photos_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "attendance_photos_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "storage_select_policy_anon" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_policy_anon" ON storage.objects;

UPDATE storage.buckets
SET public = false
WHERE id = 'attendance-photos';
