-- Delete all corrupted Google Ads accounts to force fresh reconnection
-- Users will need to reconnect their Google Ads accounts

DELETE FROM google_ads_accounts 
WHERE needs_reconnection = true 
AND last_error_message LIKE '%Refresh token expired%';