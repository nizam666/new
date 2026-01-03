/*
  # Update Invoices Table Structure

  1. Changes
    - Add missing columns for invoice management
    - Rename paid_amount to amount_paid for consistency
    - Add customer_name, items, subtotal, tax_rate, tax_amount
    - Add notes and terms_conditions fields

  2. Purpose
    - Support complete invoice functionality
    - Store itemized invoice details
    - Track tax calculations
    - Add invoice terms and notes
*/

-- Add customer_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE invoices ADD COLUMN customer_name text;
  END IF;
END $$;

-- Add items column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'items'
  ) THEN
    ALTER TABLE invoices ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add subtotal column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE invoices ADD COLUMN subtotal numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- Add tax_rate column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE invoices ADD COLUMN tax_rate numeric(5,2) DEFAULT 0;
  END IF;
END $$;

-- Add tax_amount column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN tax_amount numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- Add notes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'notes'
  ) THEN
    ALTER TABLE invoices ADD COLUMN notes text;
  END IF;
END $$;

-- Add terms_conditions column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'terms_conditions'
  ) THEN
    ALTER TABLE invoices ADD COLUMN terms_conditions text;
  END IF;
END $$;

-- Add amount_paid column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'amount_paid'
  ) THEN
    ALTER TABLE invoices ADD COLUMN amount_paid numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- Copy data from paid_amount to amount_paid if paid_amount exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_amount'
  ) THEN
    UPDATE invoices SET amount_paid = COALESCE(paid_amount, 0) WHERE amount_paid = 0 OR amount_paid IS NULL;
  END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
