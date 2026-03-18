/*
  # Add billing_type to dispatch_list
*/

ALTER TABLE IF EXISTS dispatch_list
ADD COLUMN IF NOT EXISTS billing_type text DEFAULT 'with_gst';
