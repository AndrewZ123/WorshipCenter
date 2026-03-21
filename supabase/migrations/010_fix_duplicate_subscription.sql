-- Fix: Remove duplicate subscription creation trigger
-- The signup_church function now creates subscriptions explicitly (migration 009)
-- so we no longer need the trigger that was creating them automatically

-- Drop the trigger that was causing duplicate subscriptions
DROP TRIGGER IF EXISTS on_church_created ON public.churches;

-- Drop the function since it's no longer needed
DROP FUNCTION IF EXISTS public.create_church_subscription();