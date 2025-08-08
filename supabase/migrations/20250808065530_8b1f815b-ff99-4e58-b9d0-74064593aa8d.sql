-- Create enum for email frequency
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_frequency') THEN
    CREATE TYPE public.email_frequency AS ENUM ('daily', 'weekly', 'monthly');
  END IF;
END $$;

-- Create table for insights email subscriptions
CREATE TABLE IF NOT EXISTS public.insights_email_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  google_ads_account_id UUID NOT NULL,
  title TEXT DEFAULT 'Google Ads Insights',
  frequency public.email_frequency NOT NULL DEFAULT 'weekly',
  send_time TEXT NOT NULL DEFAULT '09:00', -- HH:mm 24h format
  time_zone TEXT NOT NULL DEFAULT 'UTC',   -- IANA timezone, e.g., "America/Los_Angeles"
  selected_metrics TEXT[] NOT NULL DEFAULT ARRAY['conversions','spend','impressions','clicks','cpm','ctr']::text[],
  is_paused BOOLEAN NOT NULL DEFAULT false,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_subscription_account
    FOREIGN KEY (google_ads_account_id) REFERENCES public.google_ads_accounts(id) ON DELETE CASCADE
);

-- Enable RLS for subscriptions
ALTER TABLE public.insights_email_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own subscriptions"
ON public.insights_email_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions"
ON public.insights_email_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
ON public.insights_email_subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
ON public.insights_email_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to maintain updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.insights_email_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create table for email logs
CREATE TABLE IF NOT EXISTS public.insights_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  user_id UUID NOT NULL,
  google_ads_account_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'SENT', -- SENT | FAILED
  error_message TEXT,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_log_subscription
    FOREIGN KEY (subscription_id) REFERENCES public.insights_email_subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_log_account
    FOREIGN KEY (google_ads_account_id) REFERENCES public.google_ads_accounts(id) ON DELETE CASCADE
);

-- Enable RLS for logs
ALTER TABLE public.insights_email_logs ENABLE ROW LEVEL SECURITY;

-- Policies for logs
CREATE POLICY "Users can view own logs"
ON public.insights_email_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
ON public.insights_email_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs"
ON public.insights_email_logs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs"
ON public.insights_email_logs
FOR DELETE
USING (auth.uid() = user_id);
