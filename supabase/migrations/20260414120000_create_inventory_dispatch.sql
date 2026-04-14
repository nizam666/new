/*
  # Inventory Dispatch Table

  Tracks items dispatched from storage to a person/department.
  Supports returnable vs non-returnable items with return condition tracking.
*/

CREATE TABLE IF NOT EXISTS inventory_dispatch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_ref text NOT NULL,
  item_id uuid REFERENCES inventory_items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  quantity_dispatched numeric NOT NULL,
  unit text NOT NULL,
  dispatched_to text NOT NULL,
  department text,
  dispatch_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date date,
  returnable boolean NOT NULL DEFAULT false,
  returned boolean NOT NULL DEFAULT false,
  return_date date,
  return_condition text CHECK (return_condition IN ('good', 'ok', 'bad', 'damaged')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_dispatch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dispatches"
  ON inventory_dispatch FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert dispatches"
  ON inventory_dispatch FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can update dispatches"
  ON inventory_dispatch FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'director')
    )
  );

CREATE INDEX IF NOT EXISTS idx_inventory_dispatch_item_id ON inventory_dispatch(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_dispatch_dispatched_to ON inventory_dispatch(dispatched_to);
CREATE INDEX IF NOT EXISTS idx_inventory_dispatch_date ON inventory_dispatch(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_inventory_dispatch_returned ON inventory_dispatch(returned);
