-- Remove public access to the attendance detail view and run it with caller privileges.
-- The view contains employee identifiers, photo URLs, and location data.
ALTER VIEW public.attendance_details_view SET (security_invoker = true);

REVOKE ALL ON TABLE public.attendance_details_view FROM anon;
REVOKE SELECT ON TABLE public.attendance_details_view FROM anon;

GRANT SELECT ON TABLE public.attendance_details_view TO authenticated;
GRANT SELECT ON TABLE public.attendance_details_view TO service_role;
