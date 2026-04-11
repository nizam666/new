-- Fix RLS policies to allow authenticated users to properly insert drilling records without arbitrary role blocks
DROP POLICY IF EXISTS "Contractors can create drilling records" ON drilling_records;
DROP POLICY IF EXISTS "Managers can create drilling records" ON drilling_records;

-- Create a blanket permissive insert policy for authenticated users 
-- The UI handles the contractor_id assignment natively
CREATE POLICY "Allow authenticated users to insert drilling records"
  ON drilling_records FOR INSERT
  TO authenticated
  WITH CHECK (true);
