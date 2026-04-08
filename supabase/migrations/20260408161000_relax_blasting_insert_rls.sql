-- Relax RLS for blasting_records to allow other authenticated users (like managers) to submit records
DROP POLICY IF EXISTS "Contractors can create blasting records" ON blasting_records;

CREATE POLICY "Contractors can create blasting records"
  ON blasting_records FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "Managers can create blasting records"
  ON blasting_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role IN ('manager', 'director', 'crusher_manager')
    )
  );
