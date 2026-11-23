# Playwright E2E

End-to-end coverage for the real app using a real QA church-admin account.
Chromium only, one worker, serial tests.

## Covered flows

- Login once via a setup project, then reuse `storageState`
- Dashboard, Songs, Team, Chat, Reports, and Settings pages load
- Disposable group creation (deleted in an after-all hook)
- Disposable service create / open / edit / share / delete (deleted in an
  after-all hook, even when a test fails)
- Public `/share/{token}` page opens from the generated link
- Sign-out lands on `/login` and a reloaded `/dashboard` does not bounce back

The suite asserts the session belongs to **ZZ Test Church (Cody QA)** and
never creates a church, invites people, opens billing, or touches another
church's data.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `E2E_EMAIL` | yes | QA church-admin email |
| `E2E_PASSWORD` | yes | QA church-admin password |
| `E2E_BASE_URL` | no | Defaults to `https://app.worshipcenter.app` |
| `E2E_CHURCH_NAME` | no | Defaults to `ZZ Test Church (Cody QA)` |

Do **not** create `.env`, `.env.e2e`, or any fixture containing real
credentials. Export the variables in your shell or configure GitHub Actions
secrets named `E2E_EMAIL` and `E2E_PASSWORD`.

## Run locally

```bash
npx playwright install chromium
E2E_EMAIL='you@example.org' E2E_PASSWORD='<account-password>' npm run e2e
```

A local server is started automatically only when `E2E_BASE_URL` is a
`localhost` / `127.0.0.1` URL. The deployed default needs no local build.

Useful variants:

```bash
npm run e2e -- --list          # verify discovery without a login
npm run e2e -- --headed        # watch the run
npx playwright show-report     # open the HTML report from the last run
```

## CI

`.github/workflows/e2e.yml` runs on `push` to `main`, `pull_request`, and
`workflow_dispatch`. It is gated: if the `E2E_EMAIL` and `E2E_PASSWORD`
repository secrets are not both configured, the E2E job is skipped and the
workflow stays green. On failure, `playwright-report/` and `test-results/`
are uploaded as artifacts.

## Disposable data

Created records use an `E2E <timestamp>` prefix. The service and group are
deleted in `afterAll`; the chat message is a single short prefixed message.
If a run is interrupted before cleanup, search the app for the `E2E ` prefix
and remove the leftover service/group.
