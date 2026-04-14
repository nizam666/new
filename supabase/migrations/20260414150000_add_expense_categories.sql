-- Add category column to accounts table for better expense classification
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS category text;

-- Add index for category searches
CREATE INDEX IF NOT EXISTS idx_accounts_category ON accounts(category);

-- Update existing expenses with a default category if applicable
UPDATE accounts 
SET category = 'Miscellaneous' 
WHERE transaction_type = 'expense' AND category IS NULL;
