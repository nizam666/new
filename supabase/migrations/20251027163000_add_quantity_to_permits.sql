-- Add quantity_in_mt column to permits table
ALTER TABLE public.permits
ADD COLUMN IF NOT EXISTS quantity_in_mt NUMERIC(10, 2);

-- Update RLS policies if needed
-- (No RLS policy changes needed as we're just adding a column)
