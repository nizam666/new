-- Add the new company_name column
ALTER TABLE public.permits
ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Backfill existing records with a default value if needed
UPDATE public.permits
SET company_name = 'sri_baba_blue_metals';

-- Make the column required
ALTER TABLE public.permits
ALTER COLUMN company_name SET NOT NULL;

-- Drop the old permit_number column if it exists
ALTER TABLE public.permits
DROP COLUMN IF EXISTS permit_number;
