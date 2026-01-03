/*
  # Add Payment Mode to Invoices

  1. Changes
    - Add payment_mode column to invoices table
    - Add payment_date column to track when payment was received
    - Add payment_history jsonb column to track multiple payments

  2. Purpose
    - Track how customers paid (cash, bank transfer, cheque, etc.)
    - Record payment dates
    - Support partial payments with history
*/

-- Add payment_mode column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_mode'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_mode text;
  END IF;
END $$;

-- Add payment_date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_date date;
  END IF;
END $$;

-- Add payment_history column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'payment_history'
  ) THEN
    ALTER TABLE invoices ADD COLUMN payment_history jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
