-- Add profit details columns to permits table
ALTER TABLE permits 
ADD COLUMN IF NOT EXISTS gf DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS mbl DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dmf DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS miscellaneous DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN permits.gf IS 'Green Fund / Growth Fund';
COMMENT ON COLUMN permits.mbl IS 'MBL Amount';
COMMENT ON COLUMN permits.dmf IS 'District Mineral Foundation';
COMMENT ON COLUMN permits.tds IS 'Tax Deducted at Source';
