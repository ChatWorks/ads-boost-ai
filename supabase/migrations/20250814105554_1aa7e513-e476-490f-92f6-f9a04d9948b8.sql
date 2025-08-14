-- Create hybrid data architecture tables for Google Ads metrics

-- Table 1: Permanent historical data (filled once per day)
CREATE TABLE google_ads_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  entity_type TEXT NOT NULL, -- 'account', 'campaign', 'adgroup', 'keyword'
  entity_id TEXT, -- NULL for account-level metrics
  entity_name TEXT,
  metrics JSONB NOT NULL, -- {roas: 2.5, ctr: 0.03, spend: 150.50, etc.}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(account_id, date, entity_type, entity_id)
);

-- Table 2: Short-term cache (filled ad-hoc, 1-4 hour TTL)
CREATE TABLE google_ads_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL, -- e.g: "campaigns_LAST_7_DAYS_roas,ctr"
  query_hash TEXT NOT NULL, -- Hash of the original query parameters
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(account_id, cache_key)
);

-- Indexes for optimal performance
CREATE INDEX idx_metrics_daily_lookup ON google_ads_metrics_daily(account_id, date, entity_type);
CREATE INDEX idx_metrics_daily_entity ON google_ads_metrics_daily(account_id, entity_type, entity_id);
CREATE INDEX idx_metrics_cache_lookup ON google_ads_metrics_cache(account_id, cache_key, expires_at);
CREATE INDEX idx_metrics_cache_expiry ON google_ads_metrics_cache(expires_at);

-- Enable RLS for security
ALTER TABLE google_ads_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_metrics_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for google_ads_metrics_daily
CREATE POLICY "Users can view own daily metrics" 
ON google_ads_metrics_daily FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM google_ads_accounts 
    WHERE google_ads_accounts.id = google_ads_metrics_daily.account_id 
    AND google_ads_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own daily metrics" 
ON google_ads_metrics_daily FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM google_ads_accounts 
    WHERE google_ads_accounts.id = google_ads_metrics_daily.account_id 
    AND google_ads_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own daily metrics" 
ON google_ads_metrics_daily FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM google_ads_accounts 
    WHERE google_ads_accounts.id = google_ads_metrics_daily.account_id 
    AND google_ads_accounts.user_id = auth.uid()
  )
);

-- RLS policies for google_ads_metrics_cache
CREATE POLICY "Users can view own cached metrics" 
ON google_ads_metrics_cache FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM google_ads_accounts 
    WHERE google_ads_accounts.id = google_ads_metrics_cache.account_id 
    AND google_ads_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own cached metrics" 
ON google_ads_metrics_cache FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM google_ads_accounts 
    WHERE google_ads_accounts.id = google_ads_metrics_cache.account_id 
    AND google_ads_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own cached metrics" 
ON google_ads_metrics_cache FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM google_ads_accounts 
    WHERE google_ads_accounts.id = google_ads_metrics_cache.account_id 
    AND google_ads_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own cached metrics" 
ON google_ads_metrics_cache FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM google_ads_accounts 
    WHERE google_ads_accounts.id = google_ads_metrics_cache.account_id 
    AND google_ads_accounts.user_id = auth.uid()
  )
);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM google_ads_metrics_cache 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;