/*
  # Add Employee ID to Users

  1. Changes
    - Add `employee_id` column to `users` table
    - Make `employee_id` unique to ensure no duplicates
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE users ADD COLUMN employee_id text UNIQUE;
  END IF;
END $$;

-- Create index for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
