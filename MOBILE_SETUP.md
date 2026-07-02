# WorshipCenter Mobile Setup (Capacitor)

This repo ships iOS + Android from the **same Next.js codebase** via Capacitor.
The web app stays the source of truth; mobile is a native wrapper around the
static-exported web build.

## Prerequisites

| Tool | Why | Install |
|------|-----|---------|
| **Xcode 16+** (full app, not just CLT) | iOS build/run on device/simulator | Mac App Store |
| Node 20+ | Build the web app | `brew install node` |
| Android Studio Hedgehog+ | Android build/run | developer.android.com/studio |
| CocoaPods | iOS deps | `brew install cocoapods` |

> ⚠️ **Xcode.app is required to build for iOS.** Command Line Tools alone
> are NOT enough. If `xcode-select -p` shows `/Library/Developer/CommandLineTools`,
> install Xcode from the Mac App Store, then run:
> ```bash
> sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
> sudo xcodebuild -runFirstLaunch
> sudo xcrun simctl runtime add all
> ```

One-time installs (already in `package.json`, but run once):

```bash
npm install
npx cap sync
```

## Environment

The mobile build reads the same `.env.local` as web. For Capacitor, the app must
point at the **deployed** API/auth host (the WebView cannot reach `localhost`
on a device). Set at build time:

```bash
# .env.local (already used by web)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=https://app.worshipcenter.app
NEXT_PUBLIC_API_BASE_URL=https://app.worshipcenter.app   # mobile hits deployed API
```

On web, `NEXT_PUBLIC_API_BASE_URL` can be empty/relative; the `api-base.ts`
helper falls back to `/api` automatically.

## Build & run

### 1. Build the web app + sync into native projects

```bash
npm run build:mobile
```

This runs `STATIC_EXPORT=true next build` (exports to `out/`) then `npx cap sync`,
which copies `out/` into `ios/App/App/public` and `android/app/src/main/assets/public`.

### 2a. iOS

```bash
npm run cap:ios           # opens Xcode
# In Xcode: choose a simulator/device, press Cmd+R
```

Or from the CLI (requires a booted simulator):

```bash
npm run cap:run:ios
```

First run only — install pods:

```bash
cd ios/App && pod install && cd ../..
```

### Run on your physical iPhone

> Simulators can't test push notifications, Universal Links, camera, or real
> device performance — for those you need a real device.

**Prerequisites (one-time)**

1. **Apple ID** — free works for development builds; a paid Apple Developer
   membership ($99/yr) is only needed for TestFlight / App Store.
2. **Xcode** installed and opened at least once.
3. A USB-C / Lightning cable to connect the iPhone to this Mac.

**Steps**

1. **Build + sync the web assets** (done already if you ran the steps above):
   ```bash
   npm run build:mobile
   ```

2. **Open the iOS project in Xcode:**
   ```bash
   npm run cap:ios
   ```
   If Xcode shows a "command line tools" prompt, accept it.

3. **Connect your iPhone** via USB. On the phone, tap **Trust This Computer**
   and enter the passcode.

4. **Select your signing team:**
   - In Xcode, click the top-level **App** project in the left sidebar.
   - Select the **App** target → **Signing & Capabilities** tab.
   - Check **Automatically manage signing**.
   - Under **Team**, pick your Apple ID.
     - If it's not listed: **Xcode → Settings → Accounts → + → Apple ID** and
       sign in, then come back and select it.
   - Xcode will create the provisioning profile. Wait for "Signing Certificate
     Revoked" / spinner to resolve to a green check.

5. **Select the device** in the Xcode toolbar (top center) — choose your iPhone
   (not a simulator). It will show a yellow dot until ready.

6. **Press Cmd+R** (or the ▶ play button). The first build can take a few minutes.

7. **On the iPhone**, if the app doesn't open and shows
   **"Untrusted Developer"**:
   - **Settings → General → VPN & Device Management**
   - Tap your **Apple ID Developer Certificate** → **Trust** → re-open the app.

**Common errors & fixes**

| Error | Fix |
|-------|-----|
| `Untrusted Developer` | Settings → VPN & Device Management → Trust your developer cert |
| `An App ID with Identifier "com.worshipcenter.app" is not available` | Change `PRODUCT_BUNDLE_IDENTIFIER` in Xcode to something unique, e.g. `com.yourname.worshipcenter` |
| `Provisioning profile "iOS Team Provisioning Profile" doesn't include signing certificate` | Xcode → Signing & Capabilities → toggle *Automatically manage signing* off then on |
| `Associated Domains` entitlement rejected (free account) | Remove `com.apple.developer.associated-domains` from `Info.plist` — Universal Links only work with a paid team |
| `Could not locate device support files` | Update Xcode to the version matching your iPhone's iOS |
| Stuck on **"Preparing..."** | Wait for indexing to finish, or quit/reopen Xcode |
| `cap sync` ran but Xcode shows stale assets | In Xcode: **Product → Clean Build Folder (Cmd+Shift+K)**, then re-run |

**Testing without USB (Wireless)**

After the first wired run: in Xcode → **Window → Devices and Simulators** →
select your iPhone → check **Connect via network**. Subsequent builds go over
Wi-Fi (the phone must be on the same network as this Mac).

**Viewing device logs (console, crashes, network)**

- **Window → Devices and Simulators → Open Console** for `NSLog` / JS errors.
- In Safari (Mac): **Develop → [Your iPhone] → WorshipCenter** to inspect the
  WebView (enabled by `CAPACITOR_DEBUG=1`, already set in the config).

### 2b. Android

```bash
npm run cap:android       # opens Android Studio
# In Android Studio: pick a device, press Run
```

Or from the CLI (requires a booted emulator/device):

```bash
npm run cap:run:android
```

## Deep links

- Custom scheme: `worshipcenter://` (configured in both platforms).
- Universal Links / App Links: `worshipcenter.app`, `app.worshipcenter.app`.

> Production Universal Links require an `apple-app-site-association` file served
> from `https://worshipcenter.app/.well-known/` and App Links require
> `assetlinks.json` at `https://worshipcenter.app/.well-known/`. Add these
> through your web host (not in this repo).

## What's handled automatically

- API base URL switches to the deployed host on mobile (`src/lib/api-base.ts`).
- Supabase auth redirects use the app URL / deep link (`src/lib/supabase.ts`).
- Stripe checkout returns to the app via the site URL.
- Safe-area padding is applied at the top of the app shell for the notch.
- Status bar style, splash screen hide, and Android hardware back button are
  handled in `src/components/providers/MobileBootstrap.tsx`.
- CORS allows Capacitor WebView origins (`capacitor://`, `ionic://`, `http://`).

## Native splash / icons

Replace the placeholder assets in:

- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset` and
  `ios/App/App/Assets.xcassets/Splash.imageset`
- Android: `android/app/src/main/res/mipmap-*` and
  `android/app/src/main/res/drawable*`

For automated generation, use `@capacitor/assets`:

```bash
npm i -D @capacitor/assets
# Put a 1024x1024 icon.png and 2732x2732 splash.png in ./assets
npx capacitor-assets generate
```

## Manual steps remaining (outside code)

These cannot be automated from the repo:

### Apple Developer / App Store

1. **Signing team** — In Xcode → App target → Signing & Capabilities, select
   your Apple Developer team. (Free team works for dev; paid $99/yr for
   TestFlight + App Store.)
2. **Bundle ID** — If `com.worshipcenter.app` is taken, change
   `PRODUCT_BUNDLE_IDENTIFIER` in Xcode and update `capacitor.config.json`
   `appId` to match.
3. **App Store Connect** — Create the app record, upload screenshots,
   submit for review (only when ready to ship).
4. **Universal Links** — Upload `apple-app-site-association` to
   `https://worshipcenter.app/.well-known/` with your team ID + bundle ID.

### Google Play Console

1. **Signing key** — Generate a release keystore:
   ```bash
   keytool -genkey -v -keystore worshipcenter.keystore -alias worshipcenter \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   In Android Studio → Build → Generate Signed Bundle → use this keystore.
2. **App Links** — Upload `assetlinks.json` to
   `https://worshipcenter.app/.well-known/assetlinks.json` with your
   signing certificate fingerprint.
3. **Play Console** — Create the app listing, upload AAB, fill content
   rating, submit for review.

### Supabase dashboard

1. **Auth → URL Configuration** — Add redirect URLs:
   - `https://worshipcenter.app/**` (web)
   - `worshipcenter://auth-callback` (mobile custom scheme)
   - `https://worshipcenter.app/auth-callback` (mobile universal link)

### Stripe dashboard

1. **Branding → App settings** — Add the app URL to allowed return domains.

### App icons & splash screens

Replace placeholder assets (see "Native splash / icons" above).
Use a 1024×1024 `assets/icon.png` and 2732×2732 `assets/splash.png`, then
run `npx capacitor-assets generate`.
