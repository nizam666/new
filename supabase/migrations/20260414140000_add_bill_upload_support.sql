-- Add bill_soft_copy column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bill_soft_copy TEXT;

-- Create a storage bucket for bill soft copies
INSERT INTO storage.buckets (id, name, public)
VALUES ('bill-copies', 'bill-copies', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for bill-copies bucket
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'bill-copies');

CREATE POLICY "Authenticated users can upload bill copies"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bill-copies'
);

CREATE POLICY "Users can update their own bill copies"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'bill-copies' AND
  (auth.uid() = owner OR owner IS NULL)
);

CREATE POLICY "Users can delete their own bill copies"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bill-copies' AND
  (auth.uid() = owner OR owner IS NULL)
);
