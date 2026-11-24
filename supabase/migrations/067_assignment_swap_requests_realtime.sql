-- 067_assignment_swap_requests_realtime.sql
--
-- Publish swap requests so the Team tab and /serve update their counters and
-- lists without a manual refresh. Guarded like 060: this is a no-op when the
-- table is already published or the publication does not exist.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'assignment_swap_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_swap_requests;
  END IF;
END
$$;
