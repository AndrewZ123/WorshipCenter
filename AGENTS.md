# WorshipCenter coding agent

This checkout is `/home/agent/worshipcenter-dev`, a separate working copy of
WorshipCenter. Do all work here.

## Hard rules

- Never touch `/home/agent/watcher-dev`, `/home/agent/deal-listener`, OpenBot,
  Hermes, `/home/agent/agent-brain`, scout-socks, or any running containers.
- Never put secrets in code, fixtures, logs, commit messages, or docs. Do not
  print, echo, or log API keys, tokens, passwords, or hashes. Do not read
  `.env` files (including `.env.local` and production env). Use dummy values
  in tests and for local builds.
- No real personal data in code or fixtures. Do not write to the live
  Supabase project. Do not spend money. Do not deploy.
- Never push to any remote.
- Keep diffs small and focused, and match existing style.
- Before finishing, leave these passing:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` (once a test script exists)
  - `npx next build` with dummy env vars (never real keys)
- Commit your work on the current feature branch with a clear message.

## How to work

- Prefer reusing existing helpers (`auth-middleware`, `subscription-middleware`,
  rate-limit utilities, `parseJsonSafe`, etc.) over inventing new ones.
- Do not weaken auth, billing, or tenant isolation. Fail closed in production.
- If a change would need a secret, a production write, a publish, or a spend,
  stop and say so instead of doing it.
