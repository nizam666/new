
-- Enable RLS on jcb_operations
ALTER TABLE jcb_operations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to ensure clean state
DROP POLICY IF EXISTS "Users can view own jcb operations" ON jcb_operations;
DROP POLICY IF EXISTS "Users can insert own jcb operations" ON jcb_operations;
DROP POLICY IF EXISTS "Directors can view all jcb operations" ON jcb_operations;
DROP POLICY IF EXISTS "Managers can view all jcb operations" ON jcb_operations;

-- Policies for JCB Operations
CREATE POLICY "Users can view own jcb operations"
  ON jcb_operations FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

CREATE POLICY "Users can insert own jcb operations"
  ON jcb_operations FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "Directors can view all jcb operations"
  ON jcb_operations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'director'
    )
  );

CREATE POLICY "Managers can view all jcb operations"
  ON jcb_operations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'manager'
    )
  );

-- Ensure created_at and status have defaults
ALTER TABLE jcb_operations ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE jcb_operations ALTER COLUMN status SET DEFAULT 'pending';
