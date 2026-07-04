# App Store Submission Audit Report — WorshipCenter

**App:** WorshipCenter v1.0 (Build 1) · `com.worshipcenter.app` · iOS 15.0+  
**Type:** Capacitor-wrapped Next.js web app (Hybrid) · Chakra UI + Supabase + Stripe  
**Audit Date:** July 4, 2026

---

## Legend
✅ **Pass** — Compliant  
⚠️ **Warning** — Non-blocking concern, fix recommended  
🔴 **Blocker** — Will cause rejection; must fix  
⚪ **N/A** — Not applicable  

---

## 1. Human Interface Guidelines (UI/UX)

| # | Item | Status | Notes |
|---|---|---|---|
| 1.1 | **Design Integrity** | ⚠️ | Chakra UI components look web-native, not UIKit-native. Capacitor WebView styling is acceptable for hybrid apps but text fields, buttons, and navigation lack native iOS feel (e.g., no native nav bar, no native tab bar). Mitigation: ensure spacing, typography, and animations feel polished. |
| 1.2 | **Safe Area & Layout** | ⚠️ | Capacitor `contentInset: "never"` and `StatusBar.overlaysWebView: true` means the WebView extends behind the status bar. The app sets `viewport-fit: cover` but does not use `env(safe-area-inset-*)` in CSS to inset content. Notch/Dynamic Island content clipping is possible. |
| 1.3 | **Adaptive Layout** | ⚠️ | Chakra UI is responsive by default but the app is a PWA-oriented design; iPad landscape layout may stretch content. Need to verify on iPad Pro 13" in landscape. `preferredContentMode: "mobile"` forces mobile viewport on iPad. |
| 1.4 | **Touch Targets** | ⚠️ | Chakra UI defaults are generally >= 44pt for buttons, but verify custom icon buttons, list items, and small controls in the UI. Not verifiable via static analysis. |
| 1.5 | **Text Legibility** | ✅ | Base font is Inter at 16px body. Dynamic Type is not relevant in a WebView — the app controls font sizing via CSS. Verify no truncation on key labels (service names, song titles). |
| 1.6 | **Navigation Consistency** | ⚠️ | Custom sidebar navigation (Chakra + Framer Motion), not native `UITabBar` or `UINavigationController`. Acceptable for a hybrid app but ensure the sidebar collapses properly on iPhone. |
| 1.7 | **Gestures** | ✅ | No conflicting custom gestures found. `@dnd-kit` used for drag-and-drop reordering (service plans) — verify it doesn't conflict with edge swipe to go back on iOS. |
| 1.8 | **Keyboard Handling** | ✅ | Capacitor Keyboard plugin configured with `resize: "body"` and `resizeOnFullScreen: true`. Standard WebView keyboard handling. |
| 1.9 | **Loading States** | ⚠️ | Inconsistent — some pages have skeleton/loading states, others (noted in prior audit) show blank content during data fetch. SubscriptionGate and BillingPage have proper loading states. |
| 1.10 | **Empty States** | ⚠️ | Some lists may lack descriptive empty states. Check Services list, Songs list, Team members — verify all collection views show a "no data" message with a CTA. |
| 1.11 | **Error Handling** | ⚠️ | No global error boundary component. The `store.ts` data layer silently swallows errors in many places. Some API routes return raw error messages. |
| 1.12 | **Dark Mode** | ✅ | Fully implemented via Chakra UI `useColorModeValue()` across the entire app. Manual toggle in sidebar. System preference detection is not used but not required. |
| 1.13 | **Haptic Feedback** | ✅ | `@capacitor/haptics` is installed and available. Verify it's actually used for meaningful interactions (not just decorative). |
| 1.14 | **In-App Notifications** | ✅ | Custom notification UI in the app — verify it doesn't mimic iOS system alert banners (use Chakra toast or custom components, not UIKit-style). |

---

## 2. Technical Requirements & Performance

| # | Item | Status | Notes |
|---|---|---|---|
| 2.1 | **Crash-Free Launch** | ✅ | Standard Capacitor app with no native code modifications. Low crash risk. Must test on physical devices. |
| 2.2 | **No Memory Leaks** | ⚠️ | Next.js web app — potential for memory leaks in React components (chat, real-time subscriptions, dnd-kit). Test on device with Xcode Instruments (Allocations). |
| 2.3 | **Network Resilience** | ⚠️ | PWA offline page exists (`/_offline`) but the app primarily requires network connectivity (Supabase, Stripe). No graceful degradation for API calls — errors are often silent. |
| 2.4 | **App Launch Time** | ⚠️ | Capacitor splash screen (2s) + Next.js static export load time. The WebView loads a large JS bundle; measure on physical device. Cold start may exceed 20s if bundle is large. |
| 2.5 | **Background Behavior** | ✅ | No background modes enabled. App suspends normally. |
| 2.6 | **Supported Architectures** | ✅ | Xcode project builds standard arm64. |
| 2.7 | **Minimum Deployment Target** | ✅ | iOS 15.0. No APIs require higher without availability checks (Capacitor handles this). |
| 2.8 | **No Private APIs** | ✅ | No custom native code. Capacitor and its plugins use public APIs only. |
| 2.9 | **Hardware Access** | ✅ | No camera, mic, location, or Bluetooth access requested. Permissions-Policy header explicitly blocks camera/mic/geolocation at the web layer. |
| 2.10 | **iCloud / CloudKit** | ✅ | Not used. |
| 2.11 | **Push Notifications** | ✅ | Not implemented. No push entitlement needed. |
| 2.12 | **Watch / Widget / Extensions** | ✅ | No bundled extensions. |
| 2.13 | **App Thinning / Slicing** | ✅ | Standard Xcode asset catalog slicing. |
| 2.14 | **IPv6 Compatibility** | ⚠️ | All API calls go to Supabase/Stripe URLs over HTTPS — should work on IPv6. Test on NAT64 network before submission. |

---

## 3. Privacy & Data Security (including ATT)

| # | Item | Status | Notes |
|---|---|---|---|
| 3.1 | **Privacy Manifest** | 🔴 | **No `PrivacyInfo.xcprivacy` file exists anywhere.** Required by Apple starting Spring 2024 for all apps (both app-level and SDK-level required reasons). Must create one and declare: `NSPrivacyTracking`, `NSPrivacyTrackingDomains`, `NSPrivacyCollectedDataTypes`, `NSPrivacyAccessedAPITypes`. |
| 3.2 | **Required Reasons API** | 🔴 | No privacy manifest means no required reason API declarations. The app uses JavaScript (via WebView) which accesses UserDefaults, file timestamps, and system boot time through Capacitor SDKs. These must be declared. The `@capacitor/core` SDK may use APIs requiring reasons. |
| 3.3 | **App Tracking Transparency** | ✅ | No IDFA or tracking code exists. ATT is not required. **Do not add ATT unless you add tracking.** |
| 3.4 | **Data Collection Disclosure** | 🔴 | **Not configured.** The app collects: email, name, church name, payment info (via Stripe), usage data. These must be declared in App Store Connect's "App Privacy" section. No privacy manifest means no data types declared. |
| 3.5 | **Data Linked to Identity** | 🔴 | User data (email, name, church, billing) is linked to accounts. Privacy policy must explain this linkage — no privacy policy exists. |
| 3.6 | **Account Sign-In** | ⚠️ | Email/password only via Supabase. No OAuth/social sign-in. "Sign in with Apple" is not required since no third-party sign-in is offered. If you add Google/Facebook sign-in later, SIWA becomes mandatory. |
| 3.7 | **Account Deletion** | 🔴 | **No account deletion flow exists.** This is a hard blocker. Apple Guideline 5.1.1 requires users to initiate account deletion from within the app. The Stripe Customer Portal only cancels subscriptions — it does not delete the user account. |
| 3.8 | **Password/Passkeys** | ⚠️ | Supabase handles auth with secure token storage (localStorage via Supabase JS). Passkeys/Sign in with Apple not implemented — acceptable given no social sign-in. Token persistence in localStorage is not Keychain-level security. For a hybrid app, consider `@capacitor/storage` or secure cookie-based sessions. |
| 3.9 | **Location Services** | ✅ | Not requested. Permissions-Policy blocks it. |
| 3.10 | **Photo / Camera / Mic Access** | ✅ | Not requested. File picker uses `<input type="file">`, not native camera APIs. No purpose strings needed. |
| 3.11 | **Health / Fitness Data** | ✅ | Not applicable. |
| 3.12 | **Third-Party SDKs** | ⚠️ | Vercel Analytics is first-party (Vercel's own service) and does not track across apps. Sentry is installed but not initialized — remove it or configure it. No Firebase, Google Analytics, Amplitude, or other tracking SDKs. |
| 3.13 | **Encryption Export Compliance** | ⚠️ | App uses HTTPS only (no custom encryption). `ITSAppUsesNonStandardEncryption` should be set to `false` or omitted (defaults to false). Verify this in Info.plist — currently absent, which is fine (omitted = no). |
| 3.14 | **VPN / Proxy Config** | ✅ | Not applicable. |
| 3.15 | **Certificate Transparency** | ✅ | Standard HTTPS via Supabase/Stripe. No custom certificate handling. |

---

## 4. Content & Safety

| # | Item | Status | Notes |
|---|---|---|---|
| 4.1 | **UGC — Moderation** | 🔴 | **No content filtering or moderation system.** Service Chat messages, debriefs, and notes are user-generated. Apple requires UGC apps to have content filtering, user reporting, and blocking mechanisms. |
| 4.2 | **UGC — Reporting** | 🔴 | **No reporting mechanism.** Users cannot report objectionable content in chat or team notes. |
| 4.3 | **UGC — Blocking** | 🔴 | **No user blocking mechanism.** |
| 4.4 | **UGC — Developer Contact** | ⚠️ | No support/contact page in the app. The settings page says "Contact support" but provides no link or email. Must provide an accessible contact method. |
| 4.5 | **Objectionable Content** | ✅ | Church management app — low risk of objectionable content. But UGC chat could contain it; moderation gap makes this a risk. |
| 4.6 | **Copyright** | ⚠️ | App uses Chakra UI (MIT), Inter font (SIL OFL), Framer Motion (MIT), Lucide icons (ISC) — all permissively licensed. Verify all bundled assets have proper licenses. Any custom icons or images not checked. |
| 4.7 | **In-App Purchases** | ⚠️ | Stripe is used for SaaS subscriptions ($29/mo or $290/yr). **This is correct** — physical services and subscriptions for real-world services can use non-Apple payment. However: Apple may argue this is a "reader" app depending on the primary function. Ensure the app does not also sell digital goods (e.g., digital song downloads) outside IAP. Chord charts/PDFs in the song library could be considered digital content — review carefully. |
| 4.8 | **Rating & Age Rating** | ⚠️ | App is a church management tool. Expected age rating: 4+. No 17+ content. Set accurately in App Store Connect. |
| 4.9 | **Gambling / Sweepstakes** | ✅ | Not applicable. |
| 4.10 | **Medical / Health Apps** | ✅ | Not a health app. No health claims. |
| 4.11 | **Contests / Giveaways** | ✅ | Not applicable. |

---

## 5. Metadata & Store Listing

| # | Item | Status | Notes |
|---|---|---|---|
| 5.1 | **App Name** | ✅ | "WorshipCenter" — unique, no trademark issues (verify via USPTO search). |
| 5.2 | **Subtitle** | ⚪ | Not defined in code — set during App Store Connect submission. |
| 5.3 | **Promotional Text** | ⚪ | Not defined — set during submission. |
| 5.4 | **Description** | ⚪ | Not defined — set during submission. |
| 5.5 | **Keywords** | ⚪ | Set during submission. Do not use competing app names or trademarks. |
| 5.6 | **Screenshots** | 🔴 | **No screenshots found in the repository.** Must create for all required device sizes (6.5", 6.7", 5.5", 12.9" iPad). Ensure they show current UI only. |
| 5.7 | **App Preview Video** | ⚪ | Optional. |
| 5.8 | **App Icon** | ⚠️ | Icon exists at `AppIcon-512@2x.png` (1024x1024). Verify: no transparency, no text overlay, no iMessage sticker style. PWA icons (192, 512) also present. |
| 5.9 | **Privacy Policy URL** | 🔴 | **Not defined anywhere.** A valid HTTPS privacy policy is mandatory for App Store Connect metadata. Must host at a URL accessible from all regions. |
| 5.10 | **Support URL** | 🔴 | **Not defined anywhere.** A support URL is required in App Store Connect metadata. Currently the app has no contact/support page or email. |
| 5.11 | **Marketing URL** | ⚪ | Optional. |
| 5.12 | **Age Rating** | ⚪ | Set during App Store Connect submission. Expected: 4+. |
| 5.13 | **Content Rights** | ⚪ | Prepare documentation if Apple requests proof of rights for any third-party content. |
| 5.14 | **Export Compliance** | ⚠️ | Currently not handled. Since HTTPS-only, no action needed — but verify `ITSAppUsesNonStandardEncryption` is not accidentally set. |
| 5.15 | **App Store Connect Privacy Answers** | 🔴 | Must be completed in App Store Connect. Must match the data types in the privacy manifest. Currently no manifest or data collection declarations exist. |

---

## 6. Common Rejection Reasons — Applicability

| # | Rejection Reason | Applies? | Notes |
|---|---|---|---|
| 1 | **IAP Violations (3.1.1)** | ⚠️ | Low risk currently (Stripe for SaaS is acceptable). **Risk if song library PDFs/chord charts are sold as digital downloads** — those must use StoreKit IAP. |
| 2 | **Metadata Inaccuracy (2.3)** | ⚠️ | No metadata created yet. Risk during submission if screenshots don't match actual UI. |
| 3 | **Missing Privacy Manifest (5.1.1)** | 🔴 | **Direct hit.** No PrivacyInfo.xcprivacy = rejection. |
| 4 | **Inadequate Account Deletion (5.1.1)** | 🔴 | **Direct hit.** No in-app account deletion = rejection. |
| 5 | **Crashes & Bugs (2.1)** | ⚠️ | Untested on physical device. Test before submission. |
| 6 | **Broken Links (2.1)** | 🔴 | No support URL or privacy policy URL defined = these will be 404/missing in metadata. |
| 7 | **Placeholder / Incomplete Content (2.1)** | ⚠️ | Check for any "coming soon" or placeholder pages. The audit found no obvious ones. |
| 8 | **UGC Without Filters or Reporting (1.2)** | 🔴 | **Direct hit.** Chat, debriefs, and notes are UGC with no moderation, reporting, or blocking. |
| 9 | **Insufficient ATT Prompt (5.1.1)** | ✅ | No ATT — not applicable. |
| 10 | **Hardware Access Without Purpose (5.1.1)** | ✅ | No hardware access requested. |
| 11 | **Trademark / Copyright Infringement (4.1)** | ⚠️ | "WorshipCenter" name — verify no trademark conflicts. |
| 12 | **Push Notification Overuse (4.5.4)** | ✅ | No push notifications. |
| 13 | **Ads Interfering with UX (2.3.10)** | ✅ | No ads. |
| 14 | **Sign in with Apple Non-Compliance (4.8)** | ✅ | No social sign-in offered — SIWA not required. |
| 15 | **Replica / Spam Apps (4.3)** | ✅ | Original app, not a template replica. |

---

## Blocker Summary (Must Fix Before Submission)

| # | Issue | Checklist Ref | Effort |
|---|---|---|---|
| 1 | **Create `PrivacyInfo.xcprivacy`** — required reason APIs and data collection declarations for app + Capacitor SDKs | 3.1, 3.2, 3.4 | 2-3 days |
| 2 | **Implement in-app account deletion** — API route + UI + backend logic to delete user data and cancel Stripe subscription | 3.7 | 3-5 days |
| 3 | **Add privacy policy URL** — draft and host a privacy policy covering all collected data types | 5.9 | 1-2 days |
| 4 | **Add support URL** — create a /support or /contact page in the app, or host a separate support page | 5.10 | 1 day |
| 5 | **UGC moderation & reporting** — add content reporting in chat, user blocking, and developer contact info in-app | 4.1-4.4 | 5-7 days |
| 6 | **Create App Store screenshots** — generate for all required device sizes (6.5", 6.7", 5.5", 12.9") | 5.6 | 1-2 days |
| 7 | **Complete App Store Connect metadata** — privacy answers, description, keywords, age rating | 5.15 | 1 day |
| 8 | **Safe area insets** — add CSS `env(safe-area-inset-*)` handling to prevent notch/Dynamic Island clipping | 1.2 | 0.5 day |

---

## Pre-Submission Test Plan

1. [ ] Archive and validate build in Xcode Organizer
2. [ ] Upload to TestFlight and install on physical devices (iPhone SE, iPhone 16 Pro Max, iPad Pro)
3. [ ] Test on iOS 15.0 (lowest supported) and iOS 19 (latest)
4. [ ] Test with Network Link Conditioner (3G, EDGE, packet loss)
5. [ ] Verify Stripe sandbox checkout and Customer Portal subscription cancellation
6. [ ] Walk through sign-up → subscription → usage → account deletion flow end-to-end
7. [ ] Test all screen sizes and both orientations (iPhone portrait, iPad landscape)
8. [ ] Verify icon and splash screen render correctly
9. [ ] Run Xcode Static Analyzer — fix all warnings
10. [ ] Validate all links (privacy policy, support URL) are accessible

---

*Audit performed against checklist at `.kilo/plans/app-store-submission-checklist.md`*
