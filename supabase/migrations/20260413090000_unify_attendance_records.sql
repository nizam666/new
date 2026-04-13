-- Unify Attendance Records across Selfie Terminal and Mobile Operations
-- This migration redefines attendance_details_view to include both sources.

DROP VIEW IF EXISTS attendance_details_view;

CREATE OR REPLACE VIEW attendance_details_view AS
-- 1. Selfie Terminal Records (Individual Worker Puncs)
SELECT 
    sa.id,
    sa.employee_id,
    COALESCE(w.name, u.full_name, 'Unknown') as employee_name,
    sa.date,
    sa.check_in,
    sa.check_out,
    sa.check_in_photo,
    sa.check_out_photo,
    sa.location_in,
    sa.location_out,
    sa.work_area,
    sa.created_at,
    sa.updated_at,
    'selfie' as source
FROM 
    selfie_attendance sa
LEFT JOIN 
    workers w ON UPPER(sa.employee_id) = UPPER(w.employee_id)
LEFT JOIN 
    users u ON UPPER(sa.employee_id) = UPPER(u.employee_id)

UNION ALL

-- 2. Mobile Operations / Manual Attendance (Contractor/Quarry Management punches)
SELECT 
    a.id,
    u.employee_id,
    u.full_name as employee_name,
    a.date,
    a.check_in,
    a.check_out,
    NULL as check_in_photo,
    NULL as check_out_photo,
    a.location as location_in,
    NULL as location_out,
    COALESCE(u.role, 'general') as work_area,
    a.created_at,
    a.created_at as updated_at, -- a table has no updated_at
    'manual' as source
FROM 
    attendance a
JOIN 
    users u ON a.user_id = u.id;

-- Ensure permissions are maintained
GRANT SELECT ON attendance_details_view TO anon;
GRANT SELECT ON attendance_details_view TO authenticated;
GRANT SELECT ON attendance_details_view TO service_role;
