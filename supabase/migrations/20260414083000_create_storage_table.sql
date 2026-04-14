-- Create storage table
CREATE TABLE IF NOT EXISTS storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number bigserial,
  item_name text NOT NULL,
  item_reference_number text,
  quantity numeric DEFAULT 0,
  average_price numeric DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE storage ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "All authenticated users can view storage"
  ON storage FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can insert storage"
  ON storage FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'crusher_manager', 'director')
    )
  );

CREATE POLICY "Authorized users can update storage"
  ON storage FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('manager', 'crusher_manager', 'director')
    )
  );

CREATE POLICY "Directors can delete storage"
  ON storage FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

-- Create index
CREATE INDEX IF NOT EXISTS idx_storage_item_name ON storage(item_name);
CREATE INDEX IF NOT EXISTS idx_storage_item_ref ON storage(item_reference_number);
