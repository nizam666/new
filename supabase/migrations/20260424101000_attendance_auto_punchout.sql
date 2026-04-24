-- Add columns to track automatic processing
ALTER TABLE selfie_attendance 
ADD COLUMN IF NOT EXISTS notified_10h BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_punched_out BOOLEAN DEFAULT FALSE;

-- Function to process stale attendance records
CREATE OR REPLACE FUNCTION process_stale_attendance()
RETURNS void AS $$
DECLARE
    director_id UUID;
    stale_record RECORD;
    worker_name TEXT;
BEGIN
    -- 1. Get the first Director ID to receive notifications
    SELECT id INTO director_id FROM users WHERE role = 'director' LIMIT 1;

    -- 2. Handle Previous Day Records (Aggressive Clean)
    -- Any record from a previous date that is still open should be closed to prevent blocking today's punch-ins
    FOR stale_record IN 
        SELECT sa.id, sa.employee_id, sa.check_in, sa.date, w.name
        FROM selfie_attendance sa
        LEFT JOIN workers w ON sa.employee_id = w.employee_id
        WHERE sa.check_out IS NULL 
        AND sa.date < CURRENT_DATE
    LOOP
        -- Update the record to close it
        UPDATE selfie_attendance 
        SET 
            check_out = check_in + INTERVAL '8 hours', -- Assume a standard 8h shift if they forgot
            auto_punched_out = TRUE,
            updated_at = NOW()
        WHERE id = stale_record.id;

        -- Notify Director about the cleanup
        IF director_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, title, message, metadata)
            VALUES (
                director_id,
                'attendance_cleanup',
                'Stale Session Cleaned',
                'Employee ' || stale_record.employee_id || ' (' || COALESCE(stale_record.name, 'Unknown') || ') forgot to punch out on ' || stale_record.date || '. Session auto-closed.',
                jsonb_build_object('attendance_id', stale_record.id, 'employee_id', stale_record.employee_id, 'original_date', stale_record.date)
            );
        END IF;
    END LOOP;

    -- 3. Handle 12+ hour records (Auto Punch Out for same-day shifts)
    FOR stale_record IN 
        SELECT sa.id, sa.employee_id, sa.check_in, w.name
        FROM selfie_attendance sa
        LEFT JOIN workers w ON sa.employee_id = w.employee_id
        WHERE sa.check_out IS NULL 
        AND sa.check_in < (NOW() - INTERVAL '12 hours')
        AND sa.auto_punched_out = FALSE
    LOOP
        -- Update the record
        UPDATE selfie_attendance 
        SET 
            check_out = check_in + INTERVAL '12 hours',
            auto_punched_out = TRUE,
            updated_at = NOW()
        WHERE id = stale_record.id;

        -- Notify Director
        IF director_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, title, message, metadata)
            VALUES (
                director_id,
                'attendance_alert',
                'Automatic Punch Out',
                'Employee ' || stale_record.employee_id || ' (' || COALESCE(stale_record.name, 'Unknown') || ') forgot to punch out. System automatically punched them out at 12 hours.',
                jsonb_build_object('attendance_id', stale_record.id, 'employee_id', stale_record.employee_id)
            );
        END IF;
    END LOOP;

    -- 4. Handle 10+ hour records (Warning Notification)
    FOR stale_record IN 
        SELECT sa.id, sa.employee_id, sa.check_in, w.name
        FROM selfie_attendance sa
        LEFT JOIN workers w ON sa.employee_id = w.employee_id
        WHERE sa.check_out IS NULL 
        AND sa.check_in < (NOW() - INTERVAL '12 hours')
        AND sa.check_in < (NOW() - INTERVAL '10 hours')
        AND sa.notified_10h = FALSE
        AND sa.auto_punched_out = FALSE
    LOOP
        -- Mark as notified
        UPDATE selfie_attendance 
        SET notified_10h = TRUE
        WHERE id = stale_record.id;

        -- Notify Director (Warning)
        IF director_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, title, message, metadata)
            VALUES (
                director_id,
                'attendance_warning',
                'Prolonged Shift Warning',
                'Employee ' || stale_record.employee_id || ' (' || COALESCE(stale_record.name, 'Unknown') || ') has been active for over 10 hours and has not punched out.',
                jsonb_build_object('attendance_id', stale_record.id, 'employee_id', stale_record.employee_id)
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
