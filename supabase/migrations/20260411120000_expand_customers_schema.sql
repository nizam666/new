-- Expand customers schema to support billing/delivery addresses and GST status
DO $$ 
BEGIN
    -- Add billing_address if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = 'billing_address') THEN
        ALTER TABLE customers ADD COLUMN billing_address text;
        -- Migrate existing address data to billing_address
        UPDATE customers SET billing_address = address WHERE address IS NOT NULL;
    END IF;

    -- Add delivery_address if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = 'delivery_address') THEN
        ALTER TABLE customers ADD COLUMN delivery_address text;
    END IF;

    -- Add is_gst_registered if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'customers' AND COLUMN_NAME = 'is_gst_registered') THEN
        ALTER TABLE customers ADD COLUMN is_gst_registered boolean DEFAULT true;
    END IF;
END $$;
