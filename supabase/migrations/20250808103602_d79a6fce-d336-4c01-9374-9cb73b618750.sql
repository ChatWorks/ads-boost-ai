-- Ensure upsert in google-ads-callback works by adding a proper unique constraint
-- and improve query performance for user/account lookups

-- 1) Add unique constraint for (user_id, customer_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'google_ads_accounts_user_customer_unique'
  ) THEN
    ALTER TABLE public.google_ads_accounts
    ADD CONSTRAINT google_ads_accounts_user_customer_unique UNIQUE (user_id, customer_id);
  END IF;
END$$;

-- 2) Helpful index for frequent queries
CREATE INDEX IF NOT EXISTS idx_google_ads_accounts_user_status
ON public.google_ads_accounts (user_id, connection_status);
