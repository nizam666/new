-- Unify Attendance Records across Selfie Terminal and Mobile Operations
-- This migration redefines attendance_details_view to include both sources.

DROP VIEW IF EXISTS attendance_details_view;

CREATE OR REPLACE VIEW attendance_details_view AS
-- 1. Selfie Terminal Records (Individual Worker Puncs)
SELECT 
    sa.id::text as id,
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
    a.id::text as id,
    COALESCE(u.employee_id, 'MANUAL') as employee_id,
    COALESCE(u.full_name, 'Unknown User') as employee_name,
    a.date,
    a.check_in,
    a.check_out,
    NULL as check_in_photo,
    NULL as check_out_photo,
    a.location as location_in,
    NULL as location_out,
    COALESCE(u.role, 'general') as work_area,
    a.created_at,
    a.created_at as updated_at,
    'manual' as source
FROM 
    attendance a
LEFT JOIN 
    users u ON a.user_id = u.id

UNION ALL

-- 3. Group Attendance Records (Contractor entries)
SELECT 
    ar.id::text || '-' || w.id::text as id,
    COALESCE(w.employee_id, 'UNKNOWN') as employee_id,
    COALESCE(w.name, 'Unknown Worker') as employee_name,
    ar.date,
    ar.check_in,
    ar.check_out,
    NULL as check_in_photo,
    NULL as check_out_photo,
    ar.location as location_in,
    NULL as location_out,
    CASE 
        WHEN LOWER(ar.location) = 'quarry' THEN 'quarry'
        WHEN LOWER(ar.location) IN ('crusher', 'production') THEN 'crusher'
        ELSE 'general'
    END as work_area,
    ar.created_at,
    ar.created_at as updated_at,
    'contractor' as source
FROM 
    attendance_records ar
CROSS JOIN LATERAL 
    unnest(ar.worker_ids) as worker_id_uuid
LEFT JOIN 
    workers w ON w.id::text = worker_id_uuid;

-- Ensure permissions are maintained
GRANT SELECT ON attendance_details_view TO anon;
GRANT SELECT ON attendance_details_view TO authenticated;
GRANT SELECT ON attendance_details_view TO service_role;
