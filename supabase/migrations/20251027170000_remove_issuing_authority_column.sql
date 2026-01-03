-- Remove the issuing_authority column from the permits table
ALTER TABLE public.permits
DROP COLUMN IF EXISTS issuing_authority;
