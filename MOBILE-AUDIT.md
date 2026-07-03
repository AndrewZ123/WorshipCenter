# WorshipCenter — Mobile UX/UI Audit Report

**Stack:** Next.js 16 (App Router) · Chakra UI 2 · Capacitor 8 (iOS/Android) · PWA (next-pwa)
**Scope:** Application shell, navigation, theme, global CSS, UI primitives, forms, detail pages, tables, chat
**Method:** Four parallel code audits; findings below are cross-validated (issues flagged independently by multiple auditors are marked 🔄).

---

## Executive Summary

The project has a **solid mobile foundation** — a 44px touch-target theme, `viewport-fit=cover`, iOS safe-area handling, reduced-motion support, and a desktop-table/mobile-card split on list pages. However, there are **2 critical bugs** that actively harm the product's core use case, **~22 moderate issues**, and a notable **strategic gap**: despite shipping as a native mobile app, there is no thumb-reachable bottom navigation.

The single most damaging issue is a global CSS rule (`* { user-select: none }`) that makes song lyrics, CCLI numbers, chat messages, and notes **uncopyable** across the entire app — directly undermining a worship-planning product's primary workflow.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 Moderate | 22 |
| 🔵 Suggestion | 12 |

---

## 🔴 CRITICAL

### C1. Global `user-select: none` disables all text selection 🔄
**Location:** `src/app/globals.css:441–445`
```css
* {
  -webkit-user-drag: none !important;
  user-select: none !important;
}
```
**Problem:** A universal `!important` rule turns off text selection app-wide — not just during drag (despite the misleading comment). The exception list (`:448–457`) only restores `input`/`textarea`. Everything else is permanently unselectable/uncopyable: **song lyrics, chord charts, CCLI numbers, chat messages, service descriptions, emails, error text.** This is a severe usability regression for the product's core content, and it harms accessibility (screen-magnifier users who select to read). The drag-prevention it claims to provide is **already handled** by the scoped rules at `:60–69`, `:88–98`, `:395–428`.
**Recommendation:** Delete the block entirely. Keep the dnd-kit-scoped selection rules. If image-drag prevention is wanted, scope `-webkit-user-drag: none` to `img` only.

### C2. "Tailwind" class names produce zero styling in light mode 🔄
**Location:** ~49 usages across the app (e.g., `dashboard/page.tsx`, `services/[id]/ServiceDetailClient.tsx`, `songs/[id]/SongDetailClient.tsx`, `reports/page.tsx`, `AppShell.tsx`); dark-mode overrides at `globals.css:463–551`
**Problem:** Class names like `className="text-gray-500"`, `"text-teal-600"`, `"bg-teal-50"` are used pervasively, but **there is no Tailwind in this project** (no dependency, no config, no `@tailwind` directives). These classes are inert in light mode — icons/labels render in inherited body color instead of the intended muted gray/teal. The only place they take effect is the fragile `[class*="text-gray-500"]` dark-mode attribute selectors in globals.css, which **inverts the intent**: muted-by-default icons become full-strength in light mode and only turn muted in dark mode.
**Recommendation:** Replace each `className="text-…"` with a Chakra `color=` prop driven by `useColorModeValue`. Then delete the `[class*=]` dark-mode selectors (now dead).

---

## 🟠 MODERATE

### Navigation & Layout Shell

**M1. No bottom navigation bar exists** 🔄 — `AppShell.tsx` (entire file)
The prior "bottom nav is partial" note is stale; there is **no** bottom tab bar. Mobile users reach all 8 primary destinations only via the hamburger drawer every time — a major friction point for a thumb-driven native app. **Fix:** add a fixed bottom tab bar (`<lg`) for 4–5 top destinations (Dashboard, Services, Tasks, Songs, Chat → "More"), with `padding-bottom: env(safe-area-inset-bottom)` and 44px targets.

**M2. `100vh` everywhere instead of dynamic viewport units** 🔄 — `AppShell.tsx:386,392`, `ServiceMode.tsx:323`, `ServiceChat.tsx:496`, `chat/page.tsx:454`, `_offline/page.tsx:11`
`100vh` includes the area behind Safari/Chrome's dynamic toolbar in PWA mode, so bottom content (chat input, CTA) is hidden. No `dvh/svh/lvh` usage anywhere. **Fix:** use `100dvh` with a `100vh` fallback for full-bleed heights; `svh` for elements that must stay visible.

**M3. Drawer gets a double safe-area offset** — `AppShell.tsx:443` (`mt="env(safe-area-inset-top)"`) + `globals.css:48–51` (`.chakra-modal__content { padding-top: env(safe-area-inset-top) }`)
`DrawerContent` *is* `.chakra-modal__content`, so the notch inset is applied twice → empty band at the top of the drawer on notched devices. **Fix:** apply the inset once; scope the CSS rule away from drawers.

**M4. Header `zIndex="10"` is too low** — `AppShell.tsx:409`
The fixed header sits below Chakra popovers (~1380), select menus, and the `FloatingSubscribeCTA` (z1000), so overlays render over it. **Fix:** raise to a header layer ≥1000; reserve ≥1300 for modals/drawers.

**M5. Breakpoint mismatch: Chakra `lg`=992px vs CSS `1024px`** 🔄 — `globals.css:26,40,48,60,101,…` vs `theme/index.ts` (no `breakpoints` override)
In the 992–1023px band, Chakra responsive props already render desktop chrome while globals.css still applies mobile-only rules → a 32px contradiction window with stray padding/touch-target sizing. **Fix:** set Chakra `breakpoints: { lg:'64em' }` (lg=1024) so both align (smallest change), or move CSS media queries to 991/992px.

**M6. `overflow-x: hidden` masks root causes in 3 stacked layers** — `globals.css:101–108`, `AppShell.tsx:462`, `AppShell.tsx:473`
Triple-stacking silences real overflow bugs (un-wrapped tables, fixed-width elements) instead of fixing them, and can break sticky positioning / scroll restoration. **Fix:** keep it on one scroll container only; fix the underlying overflow sources (see table findings).

**M7. Capacitor `ios.contentInset: "always"` double-insets safe areas** — `capacitor.config.json:12`
The app already handles safe areas via `viewport-fit: cover` + `env()` + runtime `StatusBar.overlaysWebView`. Adding `contentInset:"always"` makes the WebView apply insets too → padding stacks. **Fix:** set `"contentInset": "never"`. Also align `overlaysWebView` (config `false` vs runtime `true`) to avoid init flashes.

**M8. Subscription gate mis-centered inside app chrome** — `SubscriptionGate.tsx:37` (`minH="100vh"`)
The gate sits inside `.main-content` which already has `padding-top: calc(56px + safe-area)`, so the centered card is pushed below true center and forces a small scroll. **Fix:** use `minH="calc(100dvh - 56px - env(safe-area-inset-top))"` or render outside the shell.

**M9. `FloatingSubscribeCTA` ignores home-indicator inset** — `TrialBanner.tsx:129–141`
Fixed `bottom:24px` overlaps the gesture area on notched iPhones. **Fix:** `bottom: calc(24px + env(safe-area-inset-bottom))`.

### Viewport & Branding

**M10. themeColor `#6B46C1` (purple) ≠ teal brand `#0D9488`** 🔄 — `layout.tsx:24`, `manifest.json:9`, `capacitor.config.json:24,29,30`, `_offline/page.tsx:13`
Browser chrome, splash, status bar, and install UI all render purple while the in-app UI is teal. Reads as two products. **Fix:** unify on teal everywhere.

**M11. `statusBarStyle: 'black-translucent'` → invisible status text in PWA** — `layout.tsx:15` + white header (`AppShell.tsx:406`)
`black-translucent` shows **white** status glyphs over the white header → clock/battery unreadable in Add-to-Home-Screen mode. (Native Capacitor shell masks this via runtime `Style.Dark`.) **Fix:** use `'default'` or darken the header band under the notch.

**M12. Inter loaded via render-blocking external Google Fonts link** 🔄 — `layout.tsx:35–38`
Plain `<link>` in `<head>` delays first paint on mobile networks and **fails offline in the Capacitor webview** on first launch (falls back to system fonts). No `next/font`, no preconnect. **Fix:** migrate to `next/font/google` Inter (self-hosted, subset, `display=swap`, bundled into the export).

**M13. Focus outline color `#319795` ≠ brand `#0D9488` (three teals in the UI)** — `globals.css:150,157,257` vs `theme/index.ts:31`
Focus rings use Chakra's default teal.500 while brand.500 is a different teal; Tabs/Switch/Button each render slightly different teals. **Fix:** drive the outline from `var(--chakra-colors-brand-500)`; alias `teal` to `brand` in the theme.

**M14. Dark-mode `[style*="…"]` substring selectors are fragile** — `globals.css:463–554`
Matching serialized inline styles is version-dependent (a Chakra/Emotion serialization change silently breaks dark mode for teal/gray backgrounds, borders, text) and risks false positives. **Fix:** move these into component-level `useColorModeValue` / theme `baseStyle` (already done well for Card/Menu/Modal).

**M15. `!important` proliferation (~55 usages)** — `globals.css` (densest at `60–86`, `101–135`, `388–428`, `442–457`, `463–554`)
Sets up specificity wars; the global/dark-mode `!important`s permanently win over component props. **Fix:** remove from global/dark-mode rules (fix root causes); reserve for genuine one-offs (reduced-motion, drag scroll-lock).

**M16. `.skip-link` CSS exists but is never rendered** — `globals.css:253–268`
Dead CSS; no `<a class="skip-link">` anywhere → keyboard users have no "Skip to main content" (WCAG 2.4.1). **Fix:** render it as the first focusable element in `AppShell`/root layout; give main region `id="main-content"` + `role="main"`.

### UI Primitives & Touch Targets

**M17. Clickable `Avatar` is sub-44px and inaccessible** — `Avatar.tsx:86–136`
`onClick` renders a `<Box onClick>` (not a button): no `role/tabIndex/aria-label/keyboard handler`, and `sm`/`md` sizes (28/36px) are below the touch minimum. Used as a profile-menu trigger (`AppShell.tsx:328`). **Fix:** render `as="button"`, add a11y attrs, and a 44px mobile hit area.

**M18. Button `icon`/`xs`/`sm` variants and custom `IconButton` bypass the 44px safeguard** — `Button.tsx:67–89,184–216`
These set `minW:'auto'`/`h:'auto'`; only height is rescued by the global `button{min-height:44px}`, so narrow icon/small buttons stay `<44px` wide. The custom `IconButton` doesn't get `.chakra-iconbutton` and wraps in a `Tooltip` that never fires on touch. (The custom `IconButton` is currently dead code — apps import Chakra's.) **Fix:** enforce `minW:{base:44}` for standalone targets; delete or fix the dead custom `IconButton`.

**M19. File-action `IconButton`s only 4px apart** — `songs/[id]/SongDetailClient.tsx:466–498`
`HStack spacing="1"` (4px) holds 2–3 View/Download/Delete buttons; below the 8px minimum and crowded on narrow rows. **Fix:** `spacing="2"`+ and collapse into an overflow menu on mobile.

**M20. `EmptyState` description fails WCAG AA contrast** — `EmptyState.tsx:93`
`gray.400` (#9CA3AF) on `gray.50` ≈ 2.7:1 (< 4.5:1). This is the primary guidance text on empty screens. **Fix:** use `gray.500`/`gray.600`.

**M21. `ConfirmDialog` body text low-contrast in dark mode** — `ConfirmDialog.tsx:98`
Hardcoded `color="gray.600"` on a `gray.800` dialog. **Fix:** `useColorModeValue('gray.600','gray.300')`.

**M22. Skeleton placeholders hardcode `gray.100` (ignore dark mode)** — `Skeleton.tsx:65,87,119`
Light-gray bars on `gray.800` cards while the sibling `<Skeleton>` component is color-mode-aware. **Fix:** use the `<Skeleton>` component for inner placeholders.

**M23. Missing `aria-label`s on icon-only controls / unlabeled inputs** — `ServiceDetailClient.tsx:1239`, `team/page.tsx:610` (icon menu buttons), `songs/page.tsx:212` (search input), `AppShell.tsx:198` (dark-mode `Switch`)
Placeholders aren't accessible names; icon-only buttons have no name. **Fix:** add `aria-label` (or `<FormLabel>`/`aria-labelledby`).

**M24. `StatusBadge` sm uses `2xs` font (~10px)** — `StatusBadge.tsx:45`
Below the ~12px mobile legibility floor. **Fix:** floor at `xs` (12px) on mobile.

**M25. `DropdownMenu` (unused) has no collision/flip and hardcoded `white`** — `DropdownMenu.tsx:79–86,72,104–107`
Hand-rolled `getBoundingClientRect` positioning can push menus off-screen; ignores dark mode. Currently imported nowhere. **Fix:** replace with Chakra `Menu` (Popper.js) before adopting.

**M26. "Dismiss" `Link` touch target ~16px** — `OnboardingChecklist.tsx:270–282`
Text-only link with no padding/min-height. **Fix:** use a `Button variant="ghost" size="sm"`.

### Data Pages, Tables & Forms

**M27. Debrief tables have no scroll wrapper (clipped by overflow mask)** — `services/debriefs/page.tsx:215–263` and `:386–415`
Two 5-column / 4-column `<Table>`s rendered directly in `<CardBody>` with no `<TableContainer>`. The global `overflow-x:hidden` **clips** the rightmost column instead of scrolling. **Fix:** wrap in `<TableContainer overflowX="auto">`.

**M28. Billing pricing cards use hardcoded 2-col grid that never collapses** — `settings/billing/page.tsx:403` (`gridTemplateColumns:'1fr 1fr'`)
On mobile each card gets ~150px with a 40px `$40/mo` and 4-item feature list → squished/overflowing. Page also uses raw `<div style>`/`<button>` instead of Chakra (ignores theme/responsive props). **Fix:** replace with `<SimpleGrid columns={{base:1, md:2}}>`; rebuild with Chakra components.

**M29. Two-column form rows don't stack on mobile** — `ServiceDetailClient.tsx:959` (date/time), `ServiceTasks.tsx:584,620` (assignee/priority, due/depends), `services/page.tsx:695` (day/time)
`<HStack>` pairs render ~150px-wide inputs (cramped, especially native `datetime-local`) with no responsive collapse. **Fix:** `direction={{base:'column', sm:'row'}}` or `<SimpleGrid columns={{base:1, sm:2}}>`.

**M30. Reports participation table uses `Box` not `TableContainer`** — `reports/page.tsx:257–297`, `demo/reports/page.tsx:195–235`
Loses the `.chakra-table-container` touch-scroll CSS; all 5 columns remain on mobile with no card alternative (unlike the list pages). **Fix:** switch to `<TableContainer>`; add a mobile card view.

**M31. Chat input not lifted above the keyboard** — `chat/page.tsx:564–630`, `ServiceChat.tsx:599–651`
No Capacitor `@capacitor/keyboard` `keyboardWillShow` listeners; container heights hardcode `calc(100vh - …)`. On iOS/Android the input bar is covered by the soft keyboard. **Fix:** add Keyboard listeners (or `visualViewport` API) and switch height math to `100dvh`.

**M32. Service-detail Plan rows too dense; title not truncated** — `ServiceDetailClient.tsx:1173–1268` (title at `:1216`)
Long song titles wrap the row tall and crowd the action menu (the Overview snapshot correctly uses `noOfLines={1}` at `:1085`). **Fix:** add `noOfLines={1}` to the Plan title; consider stacking key/duration badges.

**M33. Drag-and-drop lacks a dedicated `TouchSensor`** — `ServiceDetailClient.tsx:155–164`, `templates/[id]/TemplateEditorClient.tsx:94–103`
Only `PointerSensor` (distance:10) is used; dnd-kit recommends `TouchSensor` for reliable iOS dragging. **Fix:** add `useSensor(TouchSensor, { activationConstraint:{ delay:150, tolerance:8 } })`.

**M34. Contact data not tappable on Team detail** — `TeamMemberDetailClient.tsx:262–271`
Email/phone are plain `<Text>`. On a mobile app these should launch the dialer/mail client. **Fix:** wrap in `<Link href="mailto:…">` / `<Link href="tel:…">`.

**M35. Drawer body-scroll-lock doesn't lock the real scroll container** — `AppShell.tsx:459–468`
The body never scrolls (shell is `overflow:hidden`); Chakra's ScrollLock locks `<body>`, so `.main-content` keeps scrolling behind the overlay (background scroll-leak). **Fix:** toggle `overflow:hidden` on `.main-content` when the drawer opens.

---

## 🔵 SUGGESTIONS

- **S1.** `textarea`/`.chakra-textarea` omitted from the 16px iOS-zoom rule (`globals.css:122–135`).
- **S2.** No `min-width:44px` on generic mobile `button` (only `.chakra-iconbutton`) (`globals.css:117–120`).
- **S3.** No edge-swipe-to-close on drawer; no contextual page title / back button in mobile header.
- **S4.** Active-nav item reflows on activation via negative margin (`AppShell.tsx:172–175`) — use a transparent border instead.
- **S5.** `SortableItem` touch handlers are vestigial (store coords never read) and its drag-handle `Tooltip` never fires on touch.
- **S6.** `EmptyState` CTA uses `size="sm"` — render at `md` + full-width on mobile.
- **S7.** Song-detail PDF viewer iframe hardcodes `h="600px"` (`SongDetailClient.tsx:589`) — make responsive `h={{base:'70vh', md:'600px'}}`.
- **S8.** No sticky save bar on long edit forms (settings/service/song/team).
- **S9.** Chat per-bubble timestamp hidden on touch (`chat/page.tsx:204–220`); `ServiceChat` already shows it — mirror that.
- **S10.** `apple-touch-icon` is 192px (180 recommended); single 512px startup image won't fit most iPhones.
- **S11.** `themeColor` has no light/dark variant; use the array form.
- **S12.** `manifest.json` has empty `screenshots[]` (weakens install prompt); empty `[role="…"]` landmark rules at `globals.css:270–287` are noise.

---

## ✅ Done Well (validate, don't change)

- `viewport-fit: cover` is set; `maximumScale` is **not** (pinch-zoom preserved — WCAG 1.4.4 ✓).
- Fixed header respects `env(safe-area-inset-top)`; header height (56px) matches `--mobile-header-height` and main-content padding.
- Theme sets 44px for `Button`/`Input`/`Select` md; globals reinforce touch heights; checkboxes/radios sized 24px.
- Drag handle is 44×44 with `touch-action:none` and a visible `GripVertical` affordance (`SortableItem.tsx`).
- List pages (Services/Songs/Team/Usage) use a correct **desktop-table / mobile-card split**.
- Two-level detail tabs use `overflowX="auto"` + `flexShrink={0}` (correct many-tabs pattern).
- `ConfirmDialog` uses `AlertDialog` (focus-trap, Escape, least-destructive ref, backdrop close).
- Reduced-motion handled (`globals.css:163–181`); forms mostly single-column with `autoComplete` attributes; chat messages use `pre-wrap` + `break-word`.
- Static export + Capacitor webDir/scheme/`trailingSlash` correctly configured; next-pwa offline shell wired.

---

## Recommended Remediation Order

**Wave 1 — Quick critical wins (hours):**
1. Delete `* { user-select: none }` (C1) — one-line fix, restores core copy workflow.
2. Wrap the 2 debrief tables + switch reports table to `TableContainer` (M27, M30).
3. Fix billing grid → `SimpleGrid` (M28).
4. Replace focus-outline color + themeColor purple→teal (M10, M13).

**Wave 2 — Strategic (1–2 days):**
5. Add bottom tab bar (M1) and switch `100vh`→`100dvh` (M2).
6. Add Capacitor Keyboard handling for chat (M31) + `TouchSensor` for drag (M33).
7. Stack the two-column form rows (M29) and add Plan-title truncation (M32).

**Wave 3 — Foundation cleanup (ongoing):**
8. Migrate Tailwind class names → Chakra `color=` (C2) and delete the `[class*=]` dark-mode selectors.
9. Migrate to `next/font` (M12); consolidate breakpoint sources (M5); prune `!important` and duplicate drag rules (M6, M15); fix a11y gaps (M16–M26).

---

*This audit was read-only; no files were modified. All findings are verifiable against the cited file:line references.*
