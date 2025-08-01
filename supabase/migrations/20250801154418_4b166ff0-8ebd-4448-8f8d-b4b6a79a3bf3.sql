-- Add is_active column to google_ads_accounts table
ALTER TABLE public.google_ads_accounts
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- Ensure all existing accounts are set to inactive by default
UPDATE public.google_ads_accounts 
SET is_active = false 
WHERE is_active IS NULL;