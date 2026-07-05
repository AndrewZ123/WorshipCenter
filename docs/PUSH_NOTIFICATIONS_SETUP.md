# Push Notifications Setup Guide

## Overview

Push notifications flow:
```
Server (sendNotification)  →  Firebase Cloud Messaging  →  Device (APNs/FCM)
```

The server sends push via FCM using a Legacy Server Key. On Android, FCM delivers
directly. On iOS, FCM relays to APNs using an Auth Key you upload to Firebase.

---

## Step 1 — Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Create a project** (or **Add project**)
3. Enter project name, e.g. `WorshipCenter`
4. **Disable Google Analytics** (not needed)
5. Click **Create project**

---

## Step 2 — Register Android App

1. In Firebase Console, click the **Android** icon (`< />`)
2. **Android package name**: `com.worshipcenter.app`
3. **App nickname**: `WorshipCenter Android`
4. Click **Register app**
5. **Download `google-services.json`** — move to:
   ```
   android/app/google-services.json
   ```
6. Click **Next** then **Skip** (the SDK steps are already handled)

---

## Step 3 — Register iOS App (Optional)

> The Capacitor Push plugin on iOS talks directly to APNs — **no Firebase iOS SDK needed.**
> You only register the iOS app in Firebase if you also want the option to send test
> notifications from the Firebase Console. The APNs Auth Key (Step 5) is what matters.

**If you want Firebase Console test-sending:**

1. In Firebase Console, click the **iOS** icon (`< / >`)
2. **iOS bundle ID**: `com.worshipcenter.app`
3. **App nickname**: `WorshipCenter iOS`
4. Click **Register app**
5. **Download `GoogleService-Info.plist`** — move to:
   ```
   ios/App/App/GoogleService-Info.plist
   ```
6. Click **Next** then **Skip**

**If you skip this step**, push still works on iOS — you just can't send test
notifications from the Firebase web UI.

---

## Step 4 — Get the FCM Server Key

1. In Firebase Console, open your project
2. Go to **Project Settings** (gear icon) → **Cloud Messaging**
3. Under **Cloud Messaging API (Legacy)**, copy the **Server key**
4. Add it to your environment:

   **Local dev (`.env.local`):**
   ```
   FCM_SERVER_KEY=AAAA...
   ```

   **Production (Vercel):**
   Add `FCM_SERVER_KEY` to Vercel project environment variables.

---

## Step 5 — Upload APNs Key (iOS Only — Paid Apple Developer Account Required)

Push to iOS devices needs an APNs Auth Key so FCM can relay through Apple's servers.
**A paid Apple Developer membership ($99/yr) is required** — free accounts cannot
generate or upload APNs keys. Without this step, iOS push will silently fail
(Android push works without it).

### Generate the APNs Auth Key in Apple Developer Portal

1. Go to https://developer.apple.com/account → **Certificates, Identifiers & Profiles**
2. Under **Keys**, click the **+** button
3. Check **Apple Push Notifications service (APNs)**
4. Click **Continue** → **Register** → **Download**
5. Save the `.p8` file (e.g. `APNsAuthKey_XXXXXXXXXX.p8`)

### Upload to Firebase Console

1. Firebase Console → Project Settings → **Cloud Messaging**
2. Under **Apple Push Notification service (APNs)**, click **Upload**
3. Select the `.p8` file, enter the **Key ID** and **Team ID** from Apple Developer
4. Click **Save**

---

## Project file reference

After setup, your project should have these new files:

| File | Required? | Purpose |
|------|-----------|---------|
| `android/app/google-services.json` | **Yes** — Android push won't compile without it | FCM Android SDK config |
| `ios/App/App/GoogleService-Info.plist` | No — iOS push works without it | Firebase iOS SDK config (test console only) |
| `.env.local` (add `FCM_SERVER_KEY=`) | **Yes** — server-to-device delivery | Server key for FCM HTTP API |
| Vercel env `FCM_SERVER_KEY` | **Yes** — production push | Same key, set in Vercel dashboard |

---

## Step 6 — Run the Database Migration

In the Supabase Dashboard SQL Editor, run:

```sql
-- 038_add_device_tokens.sql
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own device tokens"
  ON device_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device tokens"
  ON device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device tokens"
  ON device_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device tokens"
  ON device_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all device tokens"
  ON device_tokens FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

---

## Step 7 — Enable Push Capability in Xcode

1. Open the iOS project:
   ```bash
   npm run cap:ios
   ```
2. In Xcode: select **App** target → **Signing & Capabilities** tab
3. Click **+ Capability** → search for **Push Notifications** → add it
4. Also verify **Background Modes** already includes **Remote notifications** (set via Info.plist)

---

## Step 8 — Rebuild the Mobile App

```bash
npm run build:mobile
```

This re-exports the web build and syncs into both native projects.

---

## Step 9 — Test on a Physical Device

1. **Connect iPhone** via USB, select it as the run target in Xcode, press **Cmd+R**
2. Open the app, grant notification permission when prompted
3. Trigger a notification from the web app (e.g. create an assignment)
4. The notification should appear on the device as a push notification

**Debugging:**
- Run the app in Xcode and watch the console for `[Push]` log messages
- Check the device token was stored: query `device_tokens` table in Supabase
- Send a test push via Firebase Console → **Cloud Messaging** → **Send a test notification**

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `google-services.json not found` | Place the file at `android/app/google-services.json` |
| iOS push not working | Verify APNs Auth Key uploaded to Firebase Console; verify paid Apple Developer account; check Xcode Push Notifications capability is enabled |
| `FCM_SERVER_KEY not configured` | Add the server key from Firebase Console to `.env.local` and Vercel |
| Android notification permission denied | Android 13+ requires runtime permission; the app requests it via `@capacitor/push-notifications` |
| Device token not registering | Open Safari Web Inspector on the iPhone (Develop → iPhone → WorshipCenter) and look for `[Push]` console logs |
| Token stored but push not delivered | Check the FCM server key is correct; for iOS, verify the APNs Auth Key is valid and not expired |
