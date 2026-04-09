-- Create crusher_active_sessions table
CREATE TABLE IF NOT EXISTS crusher_active_sessions (
  crusher_type text PRIMARY KEY CHECK (crusher_type IN ('jaw', 'vsi')),
  mode text NOT NULL DEFAULT 'idle' CHECK (mode IN ('idle', 'production', 'breakdown')),
  production_start timestamptz,
  production_end timestamptz,
  breakdown_start timestamptz,
  material_source text,
  notes text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

-- Enable RLS
ALTER TABLE crusher_active_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view
CREATE POLICY "All authenticated users can view crusher sessions"
  ON crusher_active_sessions FOR SELECT
  TO authenticated
  USING (true);

-- Allow crusher_manager, manager, director, and chairmen to insert/update
CREATE POLICY "Management can manage crusher sessions"
  ON crusher_active_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) 
      AND users.role IN ('crusher_manager', 'manager', 'director', 'chairmen')
    )
  );

-- Enable Realtime for this table
-- (Assuming the publication 'supabase_realtime' exists, add this table to it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'crusher_active_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crusher_active_sessions;
  END IF;
END
$$;

-- Insert default rows if they don't exist
INSERT INTO crusher_active_sessions (crusher_type, mode)
VALUES 
  ('jaw', 'idle'),
  ('vsi', 'idle')
ON CONFLICT (crusher_type) DO NOTHING;
