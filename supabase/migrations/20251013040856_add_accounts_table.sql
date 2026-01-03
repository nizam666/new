/*
  # Add Accounts Management Table

  1. New Tables
    - `accounts`
      - `id` (uuid, primary key) - Unique identifier
      - `transaction_type` (text) - Type (invoice, payment, expense)
      - `invoice_number` (text) - Invoice reference number
      - `customer_name` (text) - Name of customer or recipient
      - `amount` (decimal) - Transaction amount
      - `amount_given` (decimal) - Amount paid/received
      - `balance` (decimal) - Outstanding balance
      - `reason` (text) - Purpose/reason for transaction
      - `transaction_date` (date) - Date of transaction
      - `payment_method` (text) - Method of payment (cash, bank, cheque)
      - `status` (text) - Status (paid, partial, pending, overdue)
      - `notes` (text) - Additional notes
      - `created_by` (uuid, foreign key) - User who created the record
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

  2. Security
    - Enable RLS on accounts table
    - Add policies for authenticated users to manage accounts
*/

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL,
  invoice_number text,
  customer_name text NOT NULL,
  amount decimal(12,2) NOT NULL,
  amount_given decimal(12,2) DEFAULT 0,
  balance decimal(12,2) GENERATED ALWAYS AS (amount - COALESCE(amount_given, 0)) STORED,
  reason text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Policies for accounts table
CREATE POLICY "Authenticated users can view accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and directors can insert accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('sales', 'director', 'manager')
    )
  );

CREATE POLICY "Sales and directors can update accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('sales', 'director', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('sales', 'director', 'manager')
    )
  );

CREATE POLICY "Directors can delete accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'director'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_transaction_type ON accounts(transaction_type);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_transaction_date ON accounts(transaction_date);
CREATE INDEX IF NOT EXISTS idx_accounts_customer_name ON accounts(customer_name);
