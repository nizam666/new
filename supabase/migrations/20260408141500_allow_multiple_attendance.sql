-- Remove the unique constraint that limits attendance to one per day per employee
ALTER TABLE selfie_attendance 
DROP CONSTRAINT IF EXISTS unique_employee_daily_attendance;

-- Optional: Add a check constraint to ensure check_out is after check_in
-- Note: This is handled by logic, but good to have in DB if possible.
-- However, check_out can be NULL initially, so we need to handle that.
ALTER TABLE selfie_attendance
ADD CONSTRAINT check_out_after_check_in 
CHECK (check_out IS NULL OR check_out >= check_in);
