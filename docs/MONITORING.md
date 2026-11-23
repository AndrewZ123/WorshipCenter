# Monitoring

This app has two optional, independent monitoring layers. Neither is required
for the app to run: with no configuration, both stay completely inert.

## 1. Sentry (error reporting, optional)

Sentry is **opt-in**. It only starts when a DSN is present. An unset, empty,
or whitespace-only DSN keeps the SDK a no-op on the server, edge runtime, and
in the browser.

What is already wired up:

- `src/sentry.server.config.ts` and `src/sentry.edge.config.ts` initialize the
  SDK from `SENTRY_DSN`, falling back to `NEXT_PUBLIC_SENTRY_DSN`.
- `src/instrumentation-client.ts` initializes the browser SDK from
  `NEXT_PUBLIC_SENTRY_DSN`.
- `src/instrumentation.ts` forwards server/edge request errors.
- `src/app/error.tsx` and `src/app/global-error.tsx` report client render
  errors when the browser SDK is configured.
- Tracing, Session Replay, and default PII collection are disabled and should
  stay that way.

### What you would do (only if you want error reporting)

1. Create a Next.js project in Sentry. The free Developer plan is enough for a
   small app.
2. In the Vercel project settings, add environment variables:
   - `SENTRY_DSN` — used by the server and edge runtimes.
   - `NEXT_PUBLIC_SENTRY_DSN` — used by the browser. This value is public, so
     use the same project DSN, never an auth token.
   - `SENTRY_AUTH_TOKEN` — optional. Only needed for source-map upload and
     release metadata at build time. Leave it unset if you do not want Sentry
     build-time network calls.
3. Redeploy. Until the DSN variables are set, Sentry remains a no-op.

Do not commit DSNs or tokens to the repository, and do not put them in
`NEXT_PUBLIC_*` variables other than the documented public DSN.

## 2. Uptime monitoring (optional)

`GET /api/health` is a shallow liveness check:

- No authentication, because monitors cannot sign in.
- No database round-trip, so a brief Supabase outage does not page you.
- Rate limited per client IP so the endpoint cannot be used to hammer the app.
- Returns exactly `{ "ok": true }` with HTTP 200 and no env, version,
  dependency, or error details.

### What you would do

1. Create a free uptime monitor with UptimeRobot, Better Stack (free tier), or
   cron-job.org.
2. Point it at:

   ```
   https://app.worshipcenter.app/api/health
   ```

3. Expect HTTP 200 and a JSON body of `{ "ok": true }`. Trigger the alert when
   the check fails or returns a non-200 status. A `429` means the monitor is
   polling too aggressively (or sharing an IP with one that is).

The URL is intentionally not published as a status badge on any public
marketing page. Keep it that way unless there is a deliberate decision to make
status public.
