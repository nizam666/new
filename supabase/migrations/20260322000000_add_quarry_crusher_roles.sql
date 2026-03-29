/*
  # Add quarry_worker and crusher_worker roles to users table

  1. Changes
    - Drops the existing check constraint on `role`
    - Adds an updated check constraint that includes 'quarry_worker' and 'crusher_worker'
*/

DO $$ 
DECLARE
  constraint_name text;
BEGIN
  -- get the name of the role check constraint on users table
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || constraint_name;
  END IF;

  -- Add the new constraint with quarry_worker and crusher_worker roles
  ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('contractor', 'crusher_manager', 'manager', 'sales', 'director', 'worker', 'workers', 'quarry_worker', 'crusher_worker'));
END $$;
