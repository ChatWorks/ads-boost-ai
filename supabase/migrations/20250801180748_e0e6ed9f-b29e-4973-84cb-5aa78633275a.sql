-- Reset all Google Ads accounts to force reconnection
-- This will clear the corrupt refresh tokens and reset connection status

UPDATE google_ads_accounts 
SET 
  needs_reconnection = true,
  connection_status = 'DISCONNECTED',
  last_error_message = 'Please reconnect your Google Ads account to refresh credentials',
  last_error_at = now(),
  token_expires_at = null,
  refresh_token = null
WHERE needs_reconnection = true;