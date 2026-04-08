-- Permissive RLS update for drilling_records

-- Drop the restrictive contractor-only insert policy
DROP POLICY IF EXISTS "Contractors can create drilling records" ON drilling_records;

-- Create a more permissive policy allowing any authenticated user to create records
CREATE POLICY "Contractors can create drilling records"
  ON drilling_records FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

-- Also allow managers to create records (in case manager is submitting on behalf of contractor)
CREATE POLICY "Managers can create drilling records"
  ON drilling_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director', 'crusher_manager')
    )
  );
