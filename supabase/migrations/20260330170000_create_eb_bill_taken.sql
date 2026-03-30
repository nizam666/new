/*
  # Create EB Bill Taken Table

  Records each EB billing cycle:
  - Bill amount, bill date, due date
  - KW UC reading at time of bill (before reset)
  - KW UC reset flag + reset value (usually 0)
  - Notes

  The "KW UC Reset" button marks that the meter's KW UC was reset to 0 after billing,
  so the next EB daily report can start from 0.
*/

CREATE TABLE IF NOT EXISTS eb_bill_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  bill_amount numeric NOT NULL DEFAULT 0,
  units_billed numeric NOT NULL DEFAULT 0,
  kw_uc_at_billing numeric NOT NULL DEFAULT 0,   -- KW UC reading when bill was taken
  kw_uc_reset boolean NOT NULL DEFAULT false,     -- Was KW UC reset performed?
  kw_uc_reset_value numeric NOT NULL DEFAULT 0,   -- Value after reset (usually 0)
  bill_number text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eb_bill_records ENABLE ROW LEVEL SECURITY;

-- Crusher managers, managers, directors can read all bill records
CREATE POLICY "EB bill records select"
  ON eb_bill_records FOR SELECT
  TO authenticated
  USING (
    (user_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('crusher_manager', 'manager', 'director')
    )
  );

-- Crusher managers, managers, directors can insert
CREATE POLICY "EB bill records insert"
  ON eb_bill_records FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('crusher_manager', 'manager', 'director')
    )
  );

-- Managers and directors can update
CREATE POLICY "EB bill records update"
  ON eb_bill_records FOR UPDATE
  TO authenticated
  USING (
    (user_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('manager', 'director')
    )
  )
  WITH CHECK (
    (user_id = (select auth.uid())) OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('manager', 'director')
    )
  );

-- Directors can delete
CREATE POLICY "EB bill records delete"
  ON eb_bill_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
        AND u.role IN ('manager', 'director')
    )
  );
