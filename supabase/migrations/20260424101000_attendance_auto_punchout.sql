-- Add columns to track automatic processing
ALTER TABLE selfie_attendance 
ADD COLUMN IF NOT EXISTS notified_10h BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_punched_out BOOLEAN DEFAULT FALSE;

-- Function to process stale attendance records
CREATE OR REPLACE FUNCTION process_stale_attendance()
RETURNS void AS $$
BEGIN
    -- 1. Close ALL open sessions from previous days (Standard 8h)
    UPDATE selfie_attendance 
    SET 
        check_out = check_in + INTERVAL '8 hours',
        auto_punched_out = TRUE,
        updated_at = NOW()
    WHERE check_out IS NULL 
    AND check_in IS NOT NULL
    AND date < CURRENT_DATE;

    -- 2. Close ALL open sessions older than 12 hours from today (Standard 12h)
    UPDATE selfie_attendance 
    SET 
        check_out = check_in + INTERVAL '12 hours',
        auto_punched_out = TRUE,
        updated_at = NOW()
    WHERE check_out IS NULL 
    AND check_in IS NOT NULL
    AND check_in < (NOW() - INTERVAL '12 hours');

    -- 3. Mark 10-hour warnings
    UPDATE selfie_attendance 
    SET notified_10h = TRUE
    WHERE check_out IS NULL 
    AND check_in IS NOT NULL
    AND check_in < (NOW() - INTERVAL '10 hours')
    AND notified_10h = FALSE;

    -- 4. Cleanup abandoned requests
    DELETE FROM selfie_attendance 
    WHERE punch_status = 'pending' 
    AND check_in IS NULL 
    AND created_at < (NOW() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


