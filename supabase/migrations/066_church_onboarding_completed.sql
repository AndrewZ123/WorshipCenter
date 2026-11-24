-- 066_church_onboarding_completed.sql
--
-- Server-side church onboarding completion. The setup wizard used to remember
-- skip/dismiss only in localStorage, so every new browser showed the wizard
-- again. The flag is additive and written through the admin-only
-- POST /api/church/onboarding-complete route, which scopes the update to the
-- caller's own church. RLS and existing policies are left untouched.

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.churches.onboarding_completed_at IS
  'When an admin finished, skipped, or dismissed church setup. NULL means the wizard has not been completed on the server.';
