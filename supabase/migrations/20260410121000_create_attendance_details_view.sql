-- Create a view for attendance with employee names
CREATE OR REPLACE VIEW attendance_details_view AS
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
    sa.updated_at
FROM 
    selfie_attendance sa
LEFT JOIN 
    workers w ON UPPER(sa.employee_id) = UPPER(w.employee_id)
LEFT JOIN 
    users u ON UPPER(sa.employee_id) = UPPER(u.employee_id);

-- Explicitly grant select on the view to ALL roles
GRANT SELECT ON attendance_details_view TO anon;
GRANT SELECT ON attendance_details_view TO authenticated;
GRANT SELECT ON attendance_details_view TO service_role;
