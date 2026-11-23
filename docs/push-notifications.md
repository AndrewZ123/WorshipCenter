# Push notifications (iPhone / APNs)

Push notifications are **iPhone-only** and **off by default**. They stay behind
two flags:

| Flag | Where | Effect when not `true` |
|---|---|---|
| `PUSH_ENABLED` | Server / Vercel | Every send returns `{skipped:'not_configured'}`. Nothing is sent or logged. |
| `NEXT_PUBLIC_PUSH_ENABLED` | iOS build env | The app never requests permission or registers a device token. |

Web and Android are a no-op. There is no Firebase dependency; the server talks
directly to Apple Push Notification service (APNs) over HTTP/2 with a
token-based ES256 JWT.

---

## What you need (paid Apple Developer Program required)

A **paid Apple Developer Program membership** is required. Free/personal teams
cannot create APNs Auth Keys or use the Push Notifications capability. Without
a paid membership, do not enable push: the app builds and runs fine with the
flags off.

1. **APNs Auth Key (`.p8`)** — Apple Developer → Certificates, Identifiers &
   Profiles → Keys → **+** → *Apple Push Notifications service (APNs)* →
   Continue → Register → Download. You only get one download, so store it
   securely.
2. **Key ID** — shown next to the key in Apple Developer (10 characters).
3. **Team ID** — Apple Developer → Membership details (10 characters).
4. **Bundle ID** — `com.worshipcenter.app` (must match
   `capacitor.config.json` → `appId` and the Xcode target).
5. **Push Notifications capability** — in Xcode, target **App** → Signing &
   Capabilities → **+ Capability** → *Push Notifications*.
6. **`aps-environment` entitlement** — Xcode adds
   `ios/App/App/App.entitlements` with `aps-environment` (`development` for
   debug, `production` for release). This file is intentionally **not checked
   in** here because adding the Push capability to an Xcode project signed by a
   free Apple account makes the build fail signing. Add it in Xcode only after
   enrolling in the paid program, and keep the entitlement out of builds that
   are signed by a free account.

No APNs certificate (`.p12`) is needed — the `.p8` auth key is enough.

---

## Server environment variables (Vercel / `.env.local`)

Set all of these in Vercel (Production + Preview as appropriate) and locally:

```bash
PUSH_ENABLED=true
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=XXXXXXXXXX
APNS_BUNDLE_ID=com.worshipcenter.app
# Full contents of the .p8 file. Literal \n escapes are accepted.
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# false while testing a development build; true for App Store / TestFlight builds
APNS_PRODUCTION=false
```

If any value is missing, `isPushConfigured()` is false and sends are skipped.
The private key is never returned by an API or written to logs.

---

## iOS build variables

The native bundle is a static export, so the public flag is baked in at build
time:

```bash
NEXT_PUBLIC_PUSH_ENABLED=true
```

Run `npm run build:mobile` / `npx cap sync ios` with that variable set, then
build and run the app from Xcode on a real iPhone or an iOS simulator that
supports remote push (simulators can register on recent Xcode versions;
real-device testing is more reliable).

---

## Database

Migration `038_add_device_tokens.sql` already provides everything needed:

- `device_tokens` with a global `UNIQUE(token)` constraint.
- RLS enabled: users can only `SELECT` / `INSERT` / `UPDATE` / `DELETE` their
  own rows (`auth.uid() = user_id`); the service role can manage all rows.

No additional migration is required. `/api/push/register` upserts on `token`
and always binds the row to the authenticated user; `/api/push/unregister`
only deactivates a token owned by the caller. Tokens are deactivated
automatically when APNs returns `410`, `BadDeviceToken`, or `Unregistered`.

---

## What triggers a push

All triggers run after a successful write and are no-ops when the flag/config
is missing.

| Event | Source | Recipient |
|---|---|---|
| New assignment | `POST /api/push/events` (`assignment_created`) after the client's Supabase insert; also the existing bulk-assignment route | Assigned volunteer (not the actor) |
| Schedule date/time change | `POST /api/push/events` (`schedule_changed`) after the service update | Every volunteer assigned to that service |
| Assignment removed | Existing `DELETE /api/assignments/[assignmentId]` route | Removed volunteer |
| `@mention` in church chat | `POST /api/push/events` (`mention`, `kind:'channel'`) after the message insert | Mentioned user(s), never the sender |
| `@mention` in service chat | `POST /api/push/events` (`mention`, `kind:'service'`) after the message insert | Mentioned user(s), never the sender |

The events route re-reads the record from the database and verifies the caller's
church, so the client cannot choose arbitrary recipients. Mention bodies are
truncated to 120 characters. Deep links arrive as `notification.data.url` and
are routed in-app (`/services/<id>`, `/chat?channel=<id>`).

There is currently no per-user push preference table, so the flag plus the
device-level iOS permission are the only opt-outs; the Settings screen has a
**Push Notifications** toggle for the latter.

---

## How to test

1. Apply nothing new to the database (migration 038 is already applied in
   normal environments).
2. Deploy or run the server with `PUSH_ENABLED=true` and full APNs sandbox
   credentials (`APNS_PRODUCTION=false`).
3. Build the iOS app with `NEXT_PUBLIC_PUSH_ENABLED=true` and the Push
   Notifications capability enabled in Xcode.
4. Sign in on the iPhone, open **Settings → Push Notifications**, and turn the
   toggle on. iOS shows the permission prompt at that point (not on first
   launch).
5. Verify the token was stored:

   ```sql
   select user_id, platform, is_active, updated_at
   from device_tokens
   where platform = 'ios'
   order by updated_at desc
   limit 5;
   ```

6. Assign that user to a service as a leader, or mention them in a chat. The
   push should arrive with the assignment/schedule/mention text.
7. Tap the notification and confirm the app navigates to the service or chat.
8. Turn the Settings toggle off or sign out; the token should become
   `is_active = false`.

Troubleshooting:

| Symptom | Check |
|---|---|
| Nothing sent | `PUSH_ENABLED` is exactly `true`; all five APNs vars are set; server was redeployed after adding them. |
| `BadDeviceToken` | Sandbox vs production mismatch (`APNS_PRODUCTION`), or the token belongs to a different bundle ID. |
| No prompt on iPhone | `NEXT_PUBLIC_PUSH_ENABLED` was not set when the mobile bundle was built. |
| No prompt after toggling | Notifications are denied in iOS Settings → WorshipCenter → Notifications. |
| Registration works, no delivery | Push capability / `aps-environment` entitlement missing from the Xcode target. |
