# App Store Submission Checklist

Comprehensive audit checklist based on current Apple App Store Review Guidelines.

---

## 1. Human Interface Guidelines (UI/UX)

- [ ] **Design Integrity**: App looks native on iOS/iPadOS — uses standard UIKit/SwiftUI components or faithful custom equivalents.
- [ ] **Safe Area & Layout**: Content does not clip under the notch, Dynamic Island, home indicator, or rounded corners. Safe area insets respected.
- [ ] **Adaptive Layout**: App renders correctly on all supported device sizes and orientations (Portrait, Landscape on iPad).
- [ ] **Touch Targets**: All interactive elements minimum 44x44 pt tappable area.
- [ ] **Text Legibility**: Default font sizes at least 11 pt; Dynamic Type supported where possible. No text truncation on key labels.
- [ ] **Navigation Consistency**: Standard navigation patterns (tab bars, navigation bars, modal presentation) used per platform conventions.
- [ ] **Gestures**: Custom gestures do not conflict with system-level gestures (e.g., edge swipe, control center, notification center).
- [ ] **Keyboard Handling**: Text fields properly respond to keyboard show/hide; no keyboard overlap with active fields.
- [ ] **Loading States**: Skeleton screens or activity indicators shown during network/data loading. No blank screens.
- [ ] **Empty States**: All list/collection views have a descriptive empty state when no data exists.
- [ ] **Error Handling**: User-facing error messages are human-readable (not raw error codes). Retry affordances provided where appropriate.
- [ ] **Dark Mode**: App renders correctly in both light and dark appearances, or explicitly opts out with a reason.
- [ ] **Haptic Feedback**: Tactile feedback aligned with system patterns for confirmation, error, and selection events (if applicable).
- [ ] **In-App Notifications**: Custom notification UI does not mimic system alerts (banners, badges, etc.) in appearance or behavior.

---

## 2. Technical Requirements & Performance

- [ ] **Crash-Free Launch**: App launches without crashing on device (physical device, not simulator). Test on lowest-supported OS version.
- [ ] **No Memory Leaks**: No excessive memory growth during common user flows (especially image-heavy lists, streaming media).
- [ ] **Network Resilience**: Graceful handling of no-network (offline) and poor-network (timeout, slow) conditions. Timeouts are reasonable (10-30s).
- [ ] **App Launch Time**: Cold start completes within 20 seconds. Static splash/launch screen matches final UI — no showing stale content.
- [ ] **Background Behavior**: App correctly suspends, terminates, and restores state. No excessive background CPU/network usage.
- [ ] **Supported Architectures**: Universal binary (arm64 for all devices) or correct architecture slice for target devices.
- [ ] **Minimum Deployment Target**: Deployment target supports devices the app claims to support. Verify no APIs used that require a higher OS version without availability checks.
- [ ] **No Private APIs**: No usage of non-public/private APIs (verify via `nm` or automated scanning tools).
- [ ] **Hardware Access**: All hardware usage (camera, mic, location, Bluetooth, etc.) has purpose strings in `Info.plist` and is requested only when needed.
- [ ] **iCloud / CloudKit**: If using iCloud, entitlements match the team ID and the container is properly configured.
- [ ] **Push Notifications**: Push entitlement configured, certificates valid (not expired), and notification payloads conform to APNs spec.
- [ ] **Watch / Widget / Extension Targets**: All bundled extensions have correct bundle IDs, provisioning profiles, and no missing dependencies.
- [ ] **App Thinning / Slicing**: On-demand resources (ODR) correctly tagged and hosted. Asset catalogs optimized for device family.
- [ ] **IPv6 Compatibility**: App works on IPv6-only networks (test via macOS "IPv6 NAT64" network share).

---

## 3. Privacy & Data Security (including ATT)

- [ ] **Privacy Manifest (`PrivacyInfo.xcprivates`)**: Present for app and all third-party SDKs. Required data types and reasons declared.
- [ ] **Required Reasons API**: All declared usage of required reason APIs (file timestamps, user defaults, system boot time, etc.) has a matching reason string in the manifest.
- [ ] **App Tracking Transparency (ATT)**:
  - [ ] `NSUserTrackingUsageDescription` present in `Info.plist`.
  - [ ] `ATTrackingManager.requestTrackingAuthorization()` called before IDFA access.
  - [ ] ATT prompt shown at appropriate moment (not immediately on launch blocker pattern — offer value context first).
  - [ ] App functions without tracking authorization (no gating core functionality behind ATT acceptance).
- [ ] **Data Collection Disclosure**: All collected data types accurately reflected in App Store Connect "App Privacy" section (contact info, identifiers, usage data, diagnostics, etc.).
- [ ] **Data Linked to Identity**: If data is collected and linked to the user, privacy policy explains the linkage.
- [ ] **Account Sign-In**: Social sign-in (Sign in with Apple, Google, etc.) offered where accounts are required. "Sign in with Apple" mandatory if app uses third-party sign-in.
- [ ] **Account Deletion**: Users can initiate account deletion from within the app (not just via web request). Deletion removes data or clearly explains retention policy.
- [ ] **Password/Passkeys**: Authentication uses secure token storage (Keychain, not UserDefaults). Supports Sign in with Apple / Passkeys where applicable.
- [ ] **Location Services**: Access requested only when feature requires it. "While Using" permission preferred; "Always" prompted only with clear justification.
- [ ] **Photo / Camera / Mic Access**: Purpose strings are specific (not generic like "for app functionality"). Access requested only at point of use.
- [ ] **Health / Fitness Data**: If used, data is not shared with third parties without user consent, and not used for advertising or analytics.
- [ ] **Third-Party SDKs**: Each SDK reviewed for data collection practices. SDKs with tracking (e.g., Firebase, Amplitude, Mixpanel) counted in privacy manifest.
- [ ] **Encryption Export Compliance**: If app uses HTTPS-only, no additional export documentation needed. If custom encryption (TLS, crypto libraries), check `ITSAppUsesNonStandardEncryption` in Info.plist and export compliance docs.
- [ ] **VPN / Proxy Config**: App does not install or configure VPN profiles without explicit user consent and clear explanation.
- [ ] **Certificate Transparency**: App properly validates TLS certificates (no disabled pinning, no self-signed certs in production).

---

## 4. Content & Safety

- [ ] **User-Generated Content (UGC)**:
  - [ ] Content filtering / moderation system in place (automated or user-reported).
  - [ ] Reporting mechanism accessible within the app for objectionable content.
  - [ ] Ability to block abusive users.
  - [ ] Developer contact information easily accessible in-app.
- [ ] **Objectionable Content**: No hate speech, violence, pornography, drug use glorification, or harassment content in the app or metadata.
- [ ] **Copyright**: All bundled media (icons, images, sounds, fonts) licensed for distribution. No unlicensed third-party content.
- [ ] **In-App Purchases (IAP)**:
  - [ ] Digital goods/services use StoreKit IAP (not alternative payment processors).
  - [ ] Physical goods/services use non-IAP payment (Stripe, etc.) without a 30% digital tax.
  - [ ] IAP prices shown in local currency. No misleading pricing (e.g., free trial that auto-bills without prominent disclosure).
  - [ ] Restore Purchases mechanism implemented and tested.
  - [ ] Subscription terms clearly communicated (duration, price, auto-renewal, cancellation).
  - [ ] No "subscription trap" — cancellation is as easy as subscribing.
- [ ] **Rating & Age Rating**: App Store Connect age rating matches app content. 17+ required if: frequent mature/suggestive content, medical/treatment info, unrestricted web access, or location sharing.
- [ ] **Gambling / Sweepstakes**: No simulated gambling without age gating (17+) and legal compliance. Real-money gambling requires licenses, geo-fencing, and age verification.
- [ ] **Contests / Giveaways**: Official rules available in-app, no consideration (purchase) required to enter, and compliant with local laws.
- [ ] **Medical / Health Apps**: If providing health advice: qualified disclaimer shown, data obtained from valid sources, no life-saving claims without regulatory clearance (FDA, CE marking).
- [ ] **VPN / Security Apps**: Must comply with local laws in all distribution countries. No interfering with other apps' network requests without disclosure.

---

## 5. Metadata & Store Listing

- [ ] **App Name**: Unique, no infringing on trademarks, no "iOS" or "App Store" in name, no keyword stuffing.
- [ ] **Subtitle**: Maximum 30 characters, complements name, not repetitive.
- [ ] **Promotional Text**: Up to 170 characters, used for announcements (not keyword stuffing).
- [ ] **Description**: Clear, accurate, grammatically correct. No unsubstantiated claims ("#1", "best"). No reference to platforms, OS versions, or device models the app does not support.
- [ ] **Keywords**: Maximum 100 characters, comma-separated, no duplicates. No competing app names or trademarked terms.
- [ ] **Screenshots**:
  - [ ] Correct device frame for each upload slot (6.5", 6.7", 5.5", 12.9").
  - [ ] No more than 10% of image area covered by text.
  - [ ] No iPhone screenshots in iPad-only app (or vice versa).
  - [ ] Screenshots reflect current app UI (no mockups of unimplemented features).
  - [ ] Status bars match device (no custom mock status bars).
- [ ] **App Preview Video**: Optional. If used: 15-30 seconds, no UI not present in production app, suitable audio track.
- [ ] **Icon**: 1024x1024 pt, no transparency, no text, no iMessage sticker aesthetic, no AI-generated design.
- [ ] **Privacy Policy URL**: Valid HTTPS URL, accessible from all regions, specific to this app (not a generic template). Covers all data types the app collects.
- [ ] **Support URL**: Valid HTTPS URL, leads to working contact/support page.
- [ ] **Marketing URL**: Optional — points to app marketing site, not a generic homepage.
- [ ] **Age Rating**: Accurate selection in App Store Connect (no under-reporting to reach wider audience).
- [ ] **Content Rights**: If the app includes third-party content, proof of rights may be requested; prepare documentation.
- [ ] **Export Compliance**: `ITSAppUsesNonStandardEncryption` key correctly set. If using encryption, classification and annual report submitted to US BIS (or exemption claimed).
- [ ] **App Store Connect "App Privacy" Answers**: Complete and match the privacy manifest. Every data type collected must be declared. No missing entries.

---

## 6. Most Common Reasons for App Rejection

1. **IAP Violations** (Guideline 3.1.1) — Digital goods/services not using StoreKit; alternative payment links in the app; "reader" apps routing to external web for purchase without qualifying.
2. **Metadata Inaccuracy** (Guideline 2.3) — Screenshots show outdated UI, placeholder text in description, keyword stuffing, misleading app name or subtitle.
3. **Missing Privacy Manifest** (Guideline 5.1.1) — No `PrivacyInfo.xcprivacy` file or required reasons missing for APIs used by the app or third-party SDKs.
4. **Inadequate Account Deletion** (Guideline 5.1.1) — App does not offer in-app account deletion flow; users must contact support or visit a website.
5. **Crashes & Bugs** (Guideline 2.1) — App crashes on launch, during a primary flow, or on specific devices/OS versions during review.
6. **Broken Links** (Guideline 2.1) — Support URL, privacy policy URL, or marketing URL returns 404 or fails to load.
7. **Placeholder / Incomplete Content** (Guideline 2.1) — Empty screens, dummy data, "coming soon" labels, or "under construction" pages visible to the reviewer.
8. **UGC Without Filters or Reporting** (Guideline 1.2) — Apps with user-generated content lacking moderation, reporting tools, and contact information.
9. **Insufficient ATT Prompt Context** (Guideline 5.1.1) — ATT prompt shown on cold start without explanation of *why* tracking is needed (blaming the review rejection).
10. **Hardware Access Without Purpose** (Guideline 5.1.1) — Camera/mic/location access requested at launch before the user sees the feature that needs it; vague `Info.plist` purpose strings.
11. **Trademark / Copyright Infringement** (Guideline 4.1) — App name, icon, or content uses others' IP without authorization.
12. **Push Notification Overuse** (Guideline 4.5.4) — Sending promotional or non-essential push notifications without consent; no opt-out mechanism.
13. **Ads Interfering with UX** (Guideline 2.3.10) — Banner or interstitial ads block core functionality, are misleading, or resemble system alerts.
14. **Sign in with Apple Non-Compliance** (Guideline 4.8) — App offers Google/Facebook sign-in but omits Sign in with Apple.
15. **Replica / Spam Apps** (Guideline 4.3) — Minimal functionality, copied from template, or duplicates existing apps in the same developer account.

---

## Pre-Submission Audit Actions

1. Run the app on a **physical device** (not simulator) with the lowest supported iOS version and the latest iOS version.
2. Test on a slow/limited network (use Network Link Conditioner in Xcode or iOS Settings > Developer).
3. Verify all `Info.plist` purpose strings are specific and user-facing.
4. Confirm `PrivacyInfo.xcprivacy` includes all required reason APIs from both the app and dependencies (use `xcrun privacy` or a third-party scanner).
5. Confirm StoreKit sandbox test account works for purchasing and restore.
6. Walk through the entire sign-up, data deletion, and account termination flow.
7. Review all App Store Connect metadata fields (name, subtitle, keywords, description, screenshots, privacy answers) as if seeing them for the first time.
8. Run Xcode static analyzer and fix all warnings (potential memory leaks, logic issues).
9. Archive, distribute, and validate the build in Xcode Organizer. Upload a TestFlight build and install it via TestFlight to confirm all entitlements (push, iCloud, etc.) work end-to-end.
10. If the app has a web-service dependency, ensure the reviewer-facing environment (sandbox/staging) is stable and has demo credentials or is publicly accessible.

---

*Last updated: July 2026. Guidelines change quarterly; always review the latest [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) before submission.*
