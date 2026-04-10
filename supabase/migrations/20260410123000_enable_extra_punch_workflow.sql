-- 1. Add status and request_reason to selfie_attendance
ALTER TABLE selfie_attendance ADD COLUMN IF NOT EXISTS punch_status text DEFAULT 'approved' CHECK (punch_status IN ('approved', 'pending', 'rejected'));
ALTER TABLE selfie_attendance ADD COLUMN IF NOT EXISTS request_reason text;

-- 2. Drop the unique constraint to allow multiple punches per day
ALTER TABLE selfie_attendance DROP CONSTRAINT IF EXISTS unique_employee_daily_attendance;

-- 3. Update the approval_workflows record_type constraint
-- First, find and drop the existing constraint if it exists
DO $$ 
BEGIN 
    ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_record_type_check;
    ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_record_type_check 
    CHECK (record_type IN ('drilling', 'blasting', 'loading', 'production', 'quotation', 'order', 'extra_punch'));
END $$;

-- 4. Update the view to include these new columns for the report
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
    sa.punch_status,
    sa.request_reason,
    sa.created_at,
    sa.updated_at
FROM 
    selfie_attendance sa
LEFT JOIN 
    workers w ON UPPER(sa.employee_id) = UPPER(w.employee_id)
LEFT JOIN 
    users u ON UPPER(sa.employee_id) = UPPER(u.employee_id);
