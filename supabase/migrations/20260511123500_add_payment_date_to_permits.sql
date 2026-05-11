-- Add missing columns to permits table for full reporting support
ALTER TABLE permits 
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS quantity_in_mt DECIMAL(12,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS royalty_base DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS royalty_gst DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS royalty_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dmf_base DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dmf_gst DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dmf DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gf_base DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gf_gst DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gf DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN permits.royalty_base IS 'Base royalty amount before GST';
COMMENT ON COLUMN permits.royalty_gst IS 'GST on royalty';
COMMENT ON COLUMN permits.royalty_amount IS 'Total royalty amount (Base + GST)';

-- Update RLS policies to be more inclusive
DROP POLICY IF EXISTS "Manage permits" ON permits;
CREATE POLICY "Manage permits"
  ON permits FOR ALL
  TO authenticated
  USING (
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) AND u.role IN ('manager', 'director', 'crusher_manager', 'sales')
    ) OR
    (current_setting('request.method', true) = 'GET')
  )
  WITH CHECK (
    EXISTS (
       SELECT 1 FROM users u
       WHERE u.id = (select auth.uid()) AND u.role IN ('manager', 'director', 'crusher_manager', 'sales')
    )
  );
