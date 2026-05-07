-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Fix stale attendance auto punch-out
-- Replaces the broken process_stale_attendance function with a simpler,
-- bulletproof version using direct bulk UPDATEs instead of looping cursors.
-- Also performs a ONE-TIME cleanup of all existing open/stale records.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure required columns exist (safe to re-run)
ALTER TABLE selfie_attendance 
ADD COLUMN IF NOT EXISTS notified_10h BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_punched_out BOOLEAN DEFAULT FALSE;

-- 2. Replace the function with a simple, bulletproof bulk-update version
CREATE OR REPLACE FUNCTION process_stale_attendance()
RETURNS void AS $$
BEGIN
    -- Close ALL sessions from PREVIOUS DAYS that were left open (8h default shift)
    UPDATE selfie_attendance 
    SET 
        check_out    = check_in + INTERVAL '8 hours',
        auto_punched_out = TRUE,
        updated_at   = NOW()
    WHERE check_out IS NULL 
      AND check_in   IS NOT NULL
      AND date       < CURRENT_DATE;

    -- Close ALL sessions from TODAY that exceed 12 hours
    UPDATE selfie_attendance 
    SET 
        check_out    = check_in + INTERVAL '12 hours',
        auto_punched_out = TRUE,
        updated_at   = NOW()
    WHERE check_out IS NULL 
      AND check_in   IS NOT NULL
      AND check_in   < (NOW() - INTERVAL '12 hours');

    -- Mark 10+ hour sessions with a warning flag (does NOT close them)
    UPDATE selfie_attendance 
    SET notified_10h = TRUE
    WHERE check_out    IS NULL 
      AND check_in     IS NOT NULL
      AND check_in     < (NOW() - INTERVAL '10 hours')
      AND notified_10h = FALSE;

    -- Delete abandoned "pending" requests older than 24h with no actual punch-in
    DELETE FROM selfie_attendance 
    WHERE punch_status = 'pending' 
      AND check_in     IS NULL 
      AND created_at   < (NOW() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ONE-TIME IMMEDIATE CLEANUP: Fix all existing stale records right now
-- Previous days (any date before today)
UPDATE selfie_attendance 
SET 
    check_out        = check_in + INTERVAL '8 hours',
    auto_punched_out = TRUE,
    updated_at       = NOW()
WHERE check_out IS NULL 
  AND check_in   IS NOT NULL
  AND date       < CURRENT_DATE;

-- Same day but older than 12 hours
UPDATE selfie_attendance 
SET 
    check_out        = check_in + INTERVAL '12 hours',
    auto_punched_out = TRUE,
    updated_at       = NOW()
WHERE check_out IS NULL 
  AND check_in   IS NOT NULL
  AND check_in   < (NOW() - INTERVAL '12 hours');
