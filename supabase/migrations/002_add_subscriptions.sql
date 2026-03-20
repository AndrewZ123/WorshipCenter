-- Add subscriptions table for Stripe billing
-- This tracks the subscription status for each church

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL UNIQUE REFERENCES churches(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  trial_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick church lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_church ON subscriptions(church_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view their church's subscription
CREATE POLICY "Users can view own church subscription"
  ON subscriptions FOR SELECT
  USING (church_id = get_user_church_id());

-- Only service role (backend) can insert/update subscriptions
-- This is for Stripe webhooks
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true);

-- Function to automatically create subscription when church is created
CREATE OR REPLACE FUNCTION create_church_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (church_id, stripe_customer_id, status, trial_start, trial_end)
  VALUES (
    NEW.id,
    'cus_pending_' || NEW.id::text, -- Placeholder, will be updated when customer is created in Stripe
    'trialing',
    now(),
    now() + interval '14 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create subscription on church creation
DROP TRIGGER IF EXISTS on_church_created ON churches;
CREATE TRIGGER on_church_created
  AFTER INSERT ON churches
  FOR EACH ROW
  EXECUTE FUNCTION create_church_subscription();

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();