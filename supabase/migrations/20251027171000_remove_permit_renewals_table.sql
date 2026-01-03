-- Drop permit_renewals table if it exists
DROP TABLE IF EXISTS permit_renewals CASCADE;

-- Remove the renewal-related triggers and functions if they exist
DROP TRIGGER IF EXISTS update_permits_updated_at ON permits;
DROP FUNCTION IF EXISTS update_permits_updated_at();

-- Recreate the permits table with the correct structure
CREATE OR REPLACE FUNCTION update_permits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER update_permits_updated_at
BEFORE UPDATE ON permits
FOR EACH ROW
EXECUTE FUNCTION update_permits_updated_at();
