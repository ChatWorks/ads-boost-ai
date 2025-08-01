-- Add new columns to better track token status and provide better user experience
ALTER TABLE public.google_ads_accounts 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_error_message TEXT,
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS needs_reconnection BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_successful_fetch TIMESTAMP WITH TIME ZONE;

-- Update existing records to mark them as needing reconnection due to expired tokens
UPDATE public.google_ads_accounts 
SET needs_reconnection = true,
    connection_status = 'ERROR',
    last_error_message = 'Refresh token expired - reconnection required',
    last_error_at = now()
WHERE connection_status != 'ERROR';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_google_ads_accounts_user_active 
ON public.google_ads_accounts(user_id, is_active) 
WHERE is_active = true;