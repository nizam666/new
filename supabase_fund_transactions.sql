-- Run this in your Supabase SQL Editor
-- Creates the fund_transactions table for tracking per-source balances

CREATE TABLE IF NOT EXISTS fund_transactions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id         TEXT NOT NULL,         -- e.g. sbbm_cash, appa_account, mani_sbi
  type              TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount            NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note              TEXT,
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast balance calculations
CREATE INDEX IF NOT EXISTS idx_fund_transactions_source ON fund_transactions(source_id);
CREATE INDEX IF NOT EXISTS idx_fund_transactions_date   ON fund_transactions(transaction_date DESC);

-- Enable RLS
ALTER TABLE fund_transactions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert
CREATE POLICY "Authenticated users can view fund_transactions"
  ON fund_transactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert fund_transactions"
  ON fund_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
