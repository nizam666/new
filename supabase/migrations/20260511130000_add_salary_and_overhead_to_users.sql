-- Add salary and overhead tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_department TEXT DEFAULT 'Quarry';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_overhead BOOLEAN DEFAULT FALSE;

-- Update existing users to be non-overhead by default
UPDATE users SET is_overhead = FALSE WHERE is_overhead IS NULL;
