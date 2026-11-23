# Volunteer response links

Volunteers can confirm or decline an assignment from their email without
logging in. Each email contains single-use links to `/respond`, backed by
`assignment_response_tokens` (raw tokens are never stored — only their
SHA-256 hash). Links expire at the end of the service date (UTC), capped at
14 days, with a minimum lifetime of one hour. `GET /api/assignments/respond?t=`
only previews a token so email link scanners cannot consume it; the page POSTs
to `/api/assignments/respond` to redeem it.

Leaders see the updated status badge (pending / confirmed / declined) in the
service schedule live via Supabase Realtime on `service_assignments`, with a
refetch when the window regains focus.

## Unconfirmed reminders

The `/api/reminders` job also emails volunteers whose assignment is still
`pending` exactly **3 days** and **1 day** before the service (compared in UTC
calendar days). `assignment_reminders_sent` records each `(assignment, kind)`
pair so a reminder is never sent twice; failures are retried on the next run.

## Other reminder kinds

The same `/api/reminders` job also sends these emails, all tracked in
`assignment_reminders_sent` per `(assignment, kind)`:

- **Initial confirmation** (`initial`) — pending assignments created at least
  48 hours ago on services that are still outside the 3-day/1-day window.
- **Pre-service** (`pre_service`) — confirmed volunteers get an informational
  "you're on" email; pending volunteers get the same email with fresh
  accept/decline links within 48 hours of the service.
- **Pre-rehearsal** (`pre_rehearsal`) — the same idea within 24 hours of a
  service's rehearsal time, when one is set.
- **Leader escalation** (`escalation`) — within 24 hours of the service,
  church admins/leaders (and the service creator) receive the names and roles
  of volunteers who still have not responded.

These kinds share the recommended schedule below. No additional secret or cron
job is required.

## Recommended schedule

Run the reminder job once a day at 13:00 UTC (8 AM US Eastern):

```
0 13 * * *
```

Configure this as a Vercel Cron job that calls `/api/reminders` with the
`CRON_SECRET` value (sent as `Authorization: Bearer <CRON_SECRET>` or as a
`?secret=` query parameter). Do not commit the secret. A missing `CRON_SECRET`
fails closed in production.
