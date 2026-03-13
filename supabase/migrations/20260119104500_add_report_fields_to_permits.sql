-- Add report-related columns to permits table
ALTER TABLE permits 
ADD COLUMN IF NOT EXISTS application_no TEXT,
ADD COLUMN IF NOT EXISTS challan_no TEXT,
ADD COLUMN IF NOT EXISTS challan_date DATE,
ADD COLUMN IF NOT EXISTS bank_ref TEXT,
ADD COLUMN IF NOT EXISTS payment_mode TEXT,
ADD COLUMN IF NOT EXISTS bsr_code TEXT,
ADD COLUMN IF NOT EXISTS dmf_reference TEXT,
ADD COLUMN IF NOT EXISTS gst_reference TEXT,
ADD COLUMN IF NOT EXISTS gst_payment_date DATE,
ADD COLUMN IF NOT EXISTS permit_serial_start TEXT,
ADD COLUMN IF NOT EXISTS permit_serial_end TEXT,
ADD COLUMN IF NOT EXISTS postal_received_date DATE,
ADD COLUMN IF NOT EXISTS single_permit_ton DECIMAL(10,2);

COMMENT ON COLUMN permits.application_no IS 'Application Number';
COMMENT ON COLUMN permits.challan_no IS 'Challan Number';
COMMENT ON COLUMN permits.bank_ref IS 'Bank Reference Number';
COMMENT ON COLUMN permits.payment_mode IS 'Mode of Payment (e.g. Credit Card)';
COMMENT ON COLUMN permits.bsr_code IS 'BSR Code for TDS';
COMMENT ON COLUMN permits.dmf_reference IS 'DMF Payment Reference';
COMMENT ON COLUMN permits.gst_reference IS 'GST Payment Reference (CPIN)';
COMMENT ON COLUMN permits.single_permit_ton IS 'Ton per single permit';
