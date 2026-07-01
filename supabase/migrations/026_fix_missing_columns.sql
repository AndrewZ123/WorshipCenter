-- Add missing columns to subscriptions table
-- Run this in the Supabase SQL Editor

-- Add price_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name='subscriptions' AND column_name='price_type'
  ) THEN
    ALTER TABLE subscriptions 
    ADD COLUMN price_type TEXT CHECK (price_type IN ('monthly', 'yearly'));
  END IF;
END $$;

-- Add canceled_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name='subscriptions' AND column_name='canceled_at'
  ) THEN
    ALTER TABLE subscriptions 
    ADD COLUMN canceled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
AND column_name IN ('price_type', 'canceled_at')
ORDER BY column_name;