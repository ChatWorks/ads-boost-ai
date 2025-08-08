-- Phase 1 instrumentation prerequisite: add a profile-level default account reference
-- Adds optional selected_google_ads_account_id to profiles for fallback resolution
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS selected_google_ads_account_id UUID NULL;

-- Optional FK to google_ads_accounts for integrity (on delete set null)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_selected_google_ads_account_fk
FOREIGN KEY (selected_google_ads_account_id)
REFERENCES public.google_ads_accounts(id)
ON DELETE SET NULL;

-- Index to speed up joins/lookups
CREATE INDEX IF NOT EXISTS idx_profiles_selected_account
ON public.profiles(selected_google_ads_account_id);
