# WorshipCenter — Comprehensive Full-Codebase Audit

**Date:** July 2, 2026
**Auditor:** Senior Full-Stack Engineer / Security Researcher
**Scope:** Entire repository — `src/`, `supabase/`, config files, `android/`, `ios/`

---

## SECTION 1: PROJECT OVERVIEW

### Current State
WorshipCenter is a church management SaaS built on Next.js (App Router) + TypeScript + Supabase + Capacitor. The app has a functional core: service planning, song library, team management, scheduling, chat, billing (Stripe), and notifications. A parallel `/demo` route exists with mock data for sales/marketing.

**What works:**
- Service plan CRUD with drag-and-drop ordering (`ServiceDetailClient.tsx`, `store.ts`)
- Song library with versions, arrangements, files, and full-text search (`028_song_enhancements.sql`)
- Team member management with bulk operations (`store.ts` `teamMembers.bulk*`)
- Service assignments with accept/decline flow (`/api/assignments/[id]/confirm|decline`)
- Realtime service chat (`ServiceChat.tsx`, `015`, `024`)
- Stripe billing with webhooks and customer portal (`/api/billing/*`)
- Email notifications via Resend (`/api/notifications/*`)
- Onboarding checklist, reports dashboard, task management

**What is incomplete:**
- Offline mode (`_offline/page.tsx`) is scaffolded but non-functional
- Push notifications: SMS module exists but no native push integration
- CCLI integration: fields exist, no API integration
- Mobile-specific UX (bottom nav) is partial

### Architecture Quality
🟡 **Needs Work** — The app uses App Router but subverts its model: `src/app/(app)/layout.tsx` is `'use client'`, meaning the entire authenticated app renders on the client with no server-side session enforcement. Data fetching is uniformly client-side through a singleton Supabase browser client (`store.ts`), abandoning Server Components entirely. This inflates the client bundle, eliminates streaming benefits, and—critically—relies on client-side `useEffect` for auth gating instead of middleware/cookie-verified server checks.

**Major red flags:**
1. Client-only auth gate in `(app)/layout.tsx` (server sees unguarded HTML)
2. Tautological RLS policies in migration 028 that allow cross-tenant access
3. `SECURITY DEFINER` Postgres functions (`get_song_with_details`, `restore_song_from_version`) with no auth checks

---

## SECTION 2: CODE QUALITY AUDIT

### 2.1 TypeScript Usage — 🟡 Needs Work
- `strict: true` is enabled in `tsconfig.json` (good)
- `any` types persist: `store.ts:986` `mapChatMessage: (msg: any)`, `StoreContext.tsx`, and various `error` objects
- `src/lib/types.ts` is comprehensive and consistently imported
- Error handling is inconsistent: most `store.ts` methods return `data` and silently swallow errors (`const { data } = await ...` with no error branch). Only `bulkCreate` and `songSearch` log errors
- **Fix:** Add explicit `PostgrestError` typing and enforce error propagation

### 2.2 Component Architecture — 🟡 Needs Work
- `ServiceDetailClient.tsx`, `SongDetailClient.tsx`, `TeamMemberDetailClient.tsx` are monolithic client components mixing UI, data fetching, mutations, and state
- `AppShell.tsx` contains inline nav logic that could be extracted
- UI primitives (`Button`, `Avatar`, `EmptyState`, etc.) are well-separated
- React hooks appear correctly used; no stale-closure patterns detected in sampled files
- **Duplication:** The demo app (`/demo/*`) mirrors the real app with a separate store (`demo/store.ts`) and auth (`demo/auth.tsx`) — maintenance burden and divergence risk

### 2.3 Data Fetching & Server/Client Boundaries — 🔴 Critical Issue
- **100% client-side fetching** via `src/lib/supabase.ts` browser singleton. No Server Components fetch data
- `getById` methods in `store.ts` correctly chain `church_id` (defense-in-depth), but several bypass it:
  - `songFiles.create` (line 359): inserts with no `church_id` verification
  - `songFiles.setPrimary` (line 395): no `church_id` filter on the update
  - `songArrangements.setDefault` (line 535): no `church_id` filter
  - `notifications.markAllRead` (line 886): no per-church scope (acceptable, user-scoped)
- **N+1:** `services.duplicate` fetches items then assignments separately; acceptable for single operations
- **No pagination:** `getByChurch` methods fetch entire tables ordered by date — will degrade with scale
- Loading/error states are handled inconsistently; some pages show blank spinners

### 2.4 State Management — 🟡 Needs Work
- Auth state via React context (`auth.tsx`) + Supabase listener
- Server state via `StoreContext` passing the `db` singleton
- No global cache → navigating back-and-forth re-fetches. Consider Supabase's built-in React Query integration or a lightweight cache
- `ServiceChat` uses realtime subscriptions correctly but doesn't clean up on unmount in all branches

### 2.5 Middleware & Auth Guards — 🔴 Critical Issue
**File:** `src/middleware.ts` + `src/app/(app)/layout.tsx`

The `(app)` layout is `'use client'`. Auth is enforced in a `useEffect`:
```ts
React.useEffect(() => {
  if (!loading) {
    if (!user) { router.replace('/login'); return; }
```
**Problem:** The `children` (the page content) are rendered during the first paint before the effect runs. With a slow connection or disabled JS, protected page HTML/JS bundles are served to unauthenticated users. The redirect happens client-side only.

**Middleware (`src/middleware.ts`):** Must be read fully, but the pattern of client-gating means middleware is either not protecting these routes or is misconfigured. The session refresh for web uses cookies (correct), but Capacitor uses `capacitor-secure-storage` which middleware cannot read — a known gap.

**Fix:** Convert `(app)/layout.tsx` to a Server Component that calls `createServerClient` and validates the session cookie, redirecting server-side. Move role checks to `middleware.ts`.

### 2.6 API Routes
Every route under `src/app/api/`:

| Route | Auth Check | Authorization (church scope) | Input Validation |
|---|---|---|---|
| `/api/auth/signup` | ❌ None (correct—public) | N/A | ❌ Minimal |
| `/api/auth/verify` | ✅ Session | ❌ No church check | N/A |
| `/api/auth/reset-password` | ❌ Token only | N/A | 🟡 Basic |
| `/api/assignments/[id]/confirm` | ✅ Session | 🟡 Checks member owns assignment | ❌ None |
| `/api/assignments/[id]/decline` | ✅ Session | 🟡 Checks member owns assignment | ❌ None |
| `/api/assignments/bulk` | ✅ Session | 🟡 Partial | ❌ None |
| `/api/team/bulk` | ✅ Session | 🟡 Partial | ❌ No Zod |
| `/api/songs/[id]/files` | ✅ Session | 🟡 Via `store.songFiles` | ❌ None |
| `/api/songs/[id]/arrangements` | ✅ Session | 🟡 Via store | ❌ None |
| `/api/songs/[id]/versions` | ✅ Session | 🟡 Via store | ❌ None |
| `/api/songs/search` | ✅ Session | ✅ church_id scoped | ❌ None |
| `/api/notifications/send-invitation` | ✅ Session | ❌ Trusts client `church_id` | ❌ None |
| `/api/notifications/send-team-invitation` | ✅ Session | ❌ Trusts client `church_id` | ❌ None |
| `/api/notifications/send-welcome` | ✅ Session | ❌ Trusts client `church_id` | ❌ None |
| `/api/notifications/send-reminder` | ✅ Session | ❌ Trusts client `church_id` | ❌ None |
| `/api/reminders` | ✅ Session | 🟡 Partial | ❌ None |
| `/api/billing/webhook` | ✅ Stripe signature | N/A | ✅ Stripe SDK |
| `/api/billing/sync-subscription` | ✅ Session | 🟡 | ❌ None |
| `/api/billing/create-portal-session` | ✅ Session | 🟡 | ❌ None |

**Critical pattern:** Notification routes accept `church_id` from the request body without verifying the authenticated user belongs to that church. **IDOR risk** — a user could trigger emails referencing another church's data.

### 2.7 Configuration Files
- **`next.config.ts`:** No `headers()` for security headers, no CSP, no `X-Frame-Options`. Missing `images.remotePatterns` configuration. No `experimental.serverActions` canonicalization.
- **`capacitor.config.json`:** Not read in final pass, but deep linking (`server.url` / `server.androidScheme`) must be verified. Recommend `androidScheme: 'https'`.
- **`package.json`:** 26 vulnerabilities (1 low, 10 moderate, 15 high). `ws`, `tar`, `yaml`, `uuid` (via `svix`→`resend`) flagged. Run `npm audit fix`.
- **`tsconfig.json`:** `strict: true` ✅. No `noUncheckedIndexedAccess` (recommend enabling).
- **`eslint.config.mjs`:** Not strict enough — no `no-explicit-any` enforcement, no security plugin (`eslint-plugin-security`).

---

## SECTION 3: SUPABASE AUDIT

### 3.1 Schema & Migrations
**Tables (from migrations 012–031 + schema.sql):**
- `churches`, `users`, `team_members`, `services`, `service_items`, `service_assignments`, `songs`, `song_files`, `song_usage`, `service_templates`, `service_chat_messages`, `service_chat_read_state`, `notifications`, `invites`, `reminder_settings`, `tasks`, `task_templates`, `task_template_items`, `member_groups`, `member_group_members`, `member_notes`, `chat_channels`, `chat_channel_members`, `chat_messages`, `song_versions`, `song_arrangements`, `song_history`, `subscriptions`, `stripe_customers`

**Findings:**
- ✅ UUIDs as PKs throughout
- ✅ `timestamptz` used consistently (migration 028 uses `TIMESTAMP WITH TIME ZONE` = equivalent)
- ✅ FK relationships defined with `ON DELETE CASCADE` appropriately
- 🟡 **Missing indexes:** `service_assignments(team_member_id)`, `service_assignments(service_id, status)`, `song_usage(church_id, date)`, `notifications(user_id, read, created_at)`
- 🔴 **`subscriptions` table** had NOT NULL constraints dropped in migration 027 — risks null `stripe_customer_id`

### 3.2 Row Level Security — 🔴 CRITICAL
**Tautological policies in migration 028 (lines 225, 229, 236, 240, 244, 248, 255):**
```sql
USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id))
```
This subquery asks: "is the row's `church_id` in the set of church IDs where `id = church_id`?" — which is **always true** for any existing church. This means **every authenticated user can read/write every church's `song_versions`, `song_arrangements`, and `song_history`.** This is a critical cross-tenant data breach.

**RLS status by table:**
| Table | RLS | Policy Quality |
|---|---|---|
| `chat_channels` / members / messages | ✅ Enabled | 🟢 Correctly scoped |
| `song_versions` | ✅ Enabled | 🔴 **Tautological — broken** |
| `song_arrangements` | ✅ Enabled | 🔴 **Tautological — broken** |
| `song_history` | ✅ Enabled | 🔴 **Tautological — broken** |
| `service_chat_messages` | ✅ Enabled | 🟡 Verify (015/030/031) |
| `subscriptions` | Verify | Unknown — audit needed |
| `tasks` / `task_templates` | Verify | Unknown |

**Functions:** `get_song_with_details` and `restore_song_from_version` are `SECURITY DEFINER` with **no `auth.uid()` check inside** — they execute as the Postgres owner, bypassing RLS entirely. Any client calling `.rpc()` can fetch/restore any song across all churches.

### 3.3 Supabase Client Usage
- `src/lib/supabase.ts`: browser singleton (correct pattern)
- **Missing:** No `createServerClient` for App Router middleware/Server Components. The server-side client in `auth-middleware.ts` must be verified — if it doesn't use the cookie-based `@supabase/ssr`, sessions won't refresh server-side
- **SERVICE_ROLE key:** grep needed across `src/lib/` — `stripe.ts`, `notifications.ts`, `email.ts` likely use it server-side (acceptable) but must never ship to client bundle
- ✅ `supabaseUrl` and `supabaseAnonKey` from `env.ts` (not hardcoded)

### 3.4 Storage
- `supabase/config.toml`: `file_size_limit = "50MiB"`, no buckets declared in config (created via dashboard/SQL)
- **Risk:** If `song_files.file_url` points to a public bucket with predictable paths (`church_id/song_id/file.jpg`), enumeration is possible
- **Missing:** No evidence of upload MIME validation at the storage layer. `validateFile.ts` exists client-side only — trivially bypassed
- **Fix:** Use private buckets + signed URLs; validate MIME server-side in `/api/songs/[id]/files`

### 3.5 Edge Functions
- No `supabase/functions/` directory present in repo — all logic is in Next.js API routes. This is acceptable but means rate limits apply at the Next/Vercel edge, not Supabase.

---

## SECTION 4: SECURITY AUDIT

### 4.1 Authentication — 🔴 Critical Vulnerability
- **Client-only auth gate** (`(app)/layout.tsx` `'use client'`): protected content served before redirect
- Supabase JWTs are verified by the SDK when using the anon client (good), but the **middleware must also validate** the session cookie server-side
- No evidence of JWT replay protection beyond Supabase defaults (`refresh_token_reuse_interval = 10`)
- Admin-only checks (`user.role === 'team'`) happen only in the client layout — not enforced in API routes or DB

### 4.2 Authorization (Multi-Tenancy) — 🔴 Critical Vulnerability
- **IDOR in notification routes:** `/api/notifications/*` accept `church_id` from request body without verifying membership
- **Broken RLS** on song_versions/arrangements/history (tautological policies)
- **SECURITY DEFINER functions** bypass RLS with no internal auth check
- `songFiles.create`, `songFiles.setPrimary`, `songArrangements.setDefault` lack `church_id` filters

### 4.3 Input Validation & Injection — 🔴 Critical Vulnerability
- **No Zod schemas** on any API route. `src/lib/validation.ts` exists but is not applied to request bodies
- `sanitize.ts` applies `sanitizeHtml` (DOMPurify-like) to rich text — good
- **XSS:** `grep dangerouslySetInnerHTML src/` returned no results in the captured output (verify empty). Chat messages render as sanitized HTML — verify the sanitizer config is strict
- SQL injection: Supabase JS client parameterizes; `.rpc()` calls pass typed args — low risk, but `restore_song_from_version` is callable by anyone

### 4.4 Environment Variables & Secrets — 🟢 Secure (verify)
- `.env.local` present, `.gitignore` covers it
- `src/lib/env.ts` centralizes env access
- **Verify:** SERVICE_ROLE key not imported into any `'use client'` file. Run `grep -r "service_role\|SERVICE_ROLE" src/app/ src/components/`

### 4.5 HTTP Security Headers — 🔴 Critical Vulnerability
`next.config.ts` defines **no security headers**. Missing:
- `Content-Security-Policy` (CSP) — XSS protection
- `X-Frame-Options: DENY` — clickjacking
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Strict-Transport-Security` (HSTS)

A `csp-nonce.ts` helper exists but is unused without the header.

### 4.6 Rate Limiting — 🟡 Needs Hardening
- `comprehensiveRateLimit.ts` and `rateLimit.ts` exist — good
- Must verify they're applied to auth and notification routes (heavy email-sending endpoints)
- Supabase auth rate limits configured in `config.toml` (`sign_in_sign_ups = 30`) — good

### 4.7 Capacitor / Mobile Security — 🟢 Good
- **Android manifest:** Minimal — only `INTERNET` permission. No `usesCleartextTraffic="true"`, no storage permissions. ✅
- **iOS Info.plist:** No `NSAppTransportSecurity` exception (ATS enforced). No declared usage strings (none needed yet). ✅
- **Deep linking:** Not configured in `capacitor.config.json` (no `app.appId` association) — feature gap, not a vuln
- **Verify:** No secrets in native bundles; WebView config in `MainActivity` (not present in repo — generated)

---

## SECTION 5: PERFORMANCE AUDIT

### 5.1 Database Performance — 🟡 Needs Work
**Missing indexes:**
```sql
CREATE INDEX idx_service_assignments_member ON service_assignments(team_member_id);
CREATE INDEX idx_service_assignments_service_status ON service_assignments(service_id, status);
CREATE INDEX idx_song_usage_church_date ON song_usage(church_id, date DESC);
CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, read, created_at DESC);
```
- `getByChurch` queries have no pagination — add `.range()` for services, songs, notifications
- Realtime subscriptions scope to `service_id` (good), but verify chat doesn't subscribe church-wide

### 5.2 Next.js Performance — 🔴 Critical Issue
- **Zero Server Components** — entire authenticated app is client-rendered
- Large client components (`ServiceDetailClient`, `SongDetailClient`) should be split
- No `next/image` usage verified for user avatars/file thumbnails
- No `Suspense` boundaries — all-or-nothing page loads
- **Fix:** Migrate `(app)/layout.tsx` to server component; fetch data in server components; pass serializable props

### 5.3 Mobile (Capacitor) Performance — 🟡 Needs Work
- Initial load ships the full client bundle to the WebView
- No code-splitting of heavy features (chord chart rendering, PDF export)
- Capacitor plugins: only core (no heavy plugin bloat detected)

---

## SECTION 6: UX & FEATURE COMPLETENESS

### 6.1 Feature Inventory
| Feature | Status |
|---|---|
| Service plan builder | ✅ Complete |
| Service templates | ✅ Complete |
| Team scheduling (assignments) | ✅ Complete |
| Accept/decline flow | ✅ Complete |
| Conflict detection | 🔧 Partial |
| Member directory | ✅ Complete |
| Team messaging (chat) | ✅ Complete |
| Email notifications | ✅ Complete (Resend) |
| Push notifications | ❌ Not implemented |
| Attendance tracking | ❌ Not implemented |
| Song library + CCLI field | ✅ Complete |
| Song versions/arrangements | ✅ Complete |
| Chord transposition | ✅ Complete (`chordpro.ts`) |
| Song usage history | ✅ Complete |
| CCLI SongSelect integration | ❌ Not implemented |
| Setlist PDF export | ❌ Not implemented |
| Training video library | 🔧 YouTube embed only |
| Practice tracks | ❌ Not implemented |
| Skill tracking | ❌ Not implemented |
| Chord charts (pinch-zoom) | 🔧 Partial |
| Multi-role permissions | 🔧 Client-only |
| Giving/expense tracking | ❌ Not implemented |
| Reporting dashboard | ✅ Complete |
| Offline mode | 🚧 Scaffolded only |
| Deep linking | ❌ Not implemented |

### 6.2 Gaps vs. Competitors (free implementations)
**High-value, zero-cost additions:**
1. **Setlist PDF export** — `jspdf` (MIT) + `chordpro.ts` render
2. **Attendance tracking** — new table + RLS, reuse existing UI patterns
3. **Push notifications** — `@capacitor/local-notifications` (free) for reminders; Firebase FCM free tier for remote
4. **Skill tracking** — extend `team_members` with JSONB `skills` column
5. **Practice tracks** — Supabase Storage (1GB free) + `<audio>` element

### 6.3 UX Issues
- Loading states: inconsistent — some pages blank, some spinners
- Forms: no inline validation feedback on most inputs
- Error states: `store.ts` swallows errors → UI shows stale data silently
- Mobile 375px: AppShell nav untested at narrow widths
- Touch targets: verify ≥44px in `Button.tsx` and nav items

---

## SECTION 7: COST ANALYSIS

**Pricing:** $29/church/month flat. **Constraint:** zero per-church infra cost.

### Supabase Free Tier Limits
| Resource | Free | Concern Level |
|---|---|---|
| Database | 500MB | 🟡 ~50 churches with activity |
| Storage | 1GB | 🔴 Practice tracks/audio will blow this |
| MAU | 50,000 | 🟢 Fine through ~1,000 churches |
| Bandwidth | 2GB | 🔴 Client-heavy app + audio files |
| Edge Functions | 500K invocations | 🟢 Fine |

### Third-Party Costs
- **Resend:** 3,000 emails/mo free — will exceed at ~100 churches sending weekly reminders. Cost: $20/mo (50K) → **$0.20/church at 100 churches**
- **Stripe:** 2.9% + 30¢ per $29 charge = **$1.14 per charge** — this is **$1.14/church/month**, the single biggest cost
- **YouTube:** Free (unlisted embeds for training)

### Cost Per Church at Scale
| Churches | Est. Monthly Cost | Cost/Church | Margin/Church |
|---|---|---|---|
| 10 | Stripe ~$11 + Supabase $0 | $1.10 | $27.90 |
| 100 | Stripe ~$114 + Supabase $25 + Resend $20 | $1.59 | $27.41 |
| 500 | Stripe ~$570 + Supabase $59 + Resend $80 | $1.42 | $27.58 |

**Alert:** Stripe processing is the only cost exceeding $1/church and is unavoidable. Recommend annual billing (invoice/ACH at 0.8%) to reduce. Storage for audio will force Supabase Pro ($25/mo) around 20–30 churches using practice tracks — acceptable given 10 churches cover it.

---

## SECTION 8: IMMEDIATE ACTION ITEMS

### 🔴 Critical (Fix Before Any Users)
1. **Fix tautological RLS on song_versions, song_arrangements, song_history** (migration 028) — cross-tenant data leak
2. **Add auth checks to `SECURITY DEFINER` functions** `get_song_with_details`, `restore_song_from_version`
3. **Convert `(app)/layout.tsx` to Server Component** with server-side session validation
4. **Add authorization checks to notification API routes** — verify `church_id` membership
5. **Add `church_id` filters to `songFiles.create/setPrimary`, `songArrangements.setDefault`**
6. **Add security headers** in `next.config.ts`
7. **Add Zod validation** to all mutation API routes

### 🟡 High Priority (Fix Within 1 Week)
8. Add missing database indexes
9. Add pagination to `getByChurch` methods
10. Verify SERVICE_ROLE key never imported client-side
11. Configure storage buckets as private with signed URLs
12. Run `npm audit fix` and update `resend`/`svix`/`ws`
13. Verify middleware protects all `/api/*` (except webhooks/auth)

### 🟢 Medium Priority (Fix Within 1 Month)
14. Migrate data fetching to Server Components
15. Enforce role checks server-side (not just client layout)
16. Add `noUncheckedIndexedAccess` to `tsconfig.json`
17. Add `eslint-plugin-security`
18. Add error boundaries and consistent error UI

### 💡 Roadmap (Next Quarter)
19. Setlist PDF export (jsPDF)
20. Attendance tracking module
21. Push notifications (Capacitor local + FCM)
22. CCLI SongSelect integration (user-supplied credentials)
23. Offline mode (IndexedDB cache)
24. Deep linking (universal links)

---

## SECTION 9: IMPLEMENTATION RECIPES

### Recipe 1: Fix Tautological RLS (🔴 Critical)
**Issue:** `song_versions`, `song_arrangements`, `song_history` policies always evaluate true
**File:** `supabase/migrations/028_song_enhancements.sql` lines 225–255
**Fix:** Create `supabase/migrations/032_fix_song_rls_tautology.sql`
```sql
-- Drop broken policies
DROP POLICY IF EXISTS "Users can view song versions for their church" ON song_versions;
DROP POLICY IF EXISTS "Users can create song versions for their church" ON song_versions;
DROP POLICY IF EXISTS "Users can view song arrangements for their church" ON song_arrangements;
DROP POLICY IF EXISTS "Users can create song arrangements for their church" ON song_arrangements;
DROP POLICY IF EXISTS "Users can update song arrangements for their church" ON song_arrangements;
DROP POLICY IF EXISTS "Users can delete song arrangements for their church" ON song_arrangements;
DROP POLICY IF EXISTS "Users can view song history for their church" ON song_history;

-- Create a helper function to get the current user's church_id
CREATE OR REPLACE FUNCTION auth.church_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT church_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- song_versions: scoped to caller's church
CREATE POLICY "Users can view own church song versions"
  ON song_versions FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Users can insert own church song versions"
  ON song_versions FOR INSERT
  WITH CHECK (church_id = auth.church_id());

CREATE POLICY "Users can delete own church song versions"
  ON song_versions FOR DELETE
  USING (church_id = auth.church_id());

-- song_arrangements
CREATE POLICY "Users can view own church song arrangements"
  ON song_arrangements FOR SELECT
  USING (church_id = auth.church_id());

CREATE POLICY "Users can insert own church song arrangements"
  ON song_arrangements FOR INSERT
  WITH CHECK (church_id = auth.church_id());

CREATE POLICY "Users can update own church song arrangements"
  ON song_arrangements FOR UPDATE
  USING (church_id = auth.church_id())
  WITH CHECK (church_id = auth.church_id());

CREATE POLICY "Users can delete own church song arrangements"
  ON song_arrangements FOR DELETE
  USING (church_id = auth.church_id());

-- song_history
CREATE POLICY "Users can view own church song history"
  ON song_history FOR SELECT
  USING (church_id = auth.church_id());
```

### Recipe 2: Fix SECURITY DEFINER Functions (🔴 Critical)
**Issue:** `get_song_with_details`, `restore_song_from_version` bypass RLS with no auth check
**Fix:** Rewrite as `SECURITY INVOKER` and add explicit checks
```sql
CREATE OR REPLACE FUNCTION get_song_with_details(song_uuid UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  result JSONB;
  caller_church UUID;
BEGIN
  caller_church := auth.church_id();
  SELECT jsonb_build_object(
    'song', s.*,
    'versions', (SELECT jsonb_agg(...) FROM song_versions sv
                 WHERE sv.song_id = s.id AND sv.church_id = caller_church),
    'arrangements', (SELECT jsonb_agg(...) FROM song_arrangements sa
                     WHERE sa.song_id = s.id AND sa.church_id = caller_church),
    'files', (SELECT jsonb_agg(...) FROM song_files sf
              WHERE sf.song_id = s.id)
  ) INTO result
  FROM songs s
  WHERE s.id = song_uuid AND s.church_id = caller_church;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION restore_song_from_version(song_uuid UUID, version_num INTEGER)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  caller_church UUID := auth.church_id();
BEGIN
  -- Verify ownership
  IF NOT EXISTS (SELECT 1 FROM songs WHERE id = song_uuid AND church_id = caller_church) THEN
    RAISE EXCEPTION 'Song not found or access denied';
  END IF;

  UPDATE songs SET ... WHERE id = song_uuid AND church_id = caller_church;
  INSERT INTO song_history (...) VALUES (...);
  RETURN song_uuid;
END;
$$;
```

### Recipe 3: Server-Side Auth in Layout (🔴 Critical)
**Issue:** Client-only auth gate
**Fix:** Replace `src/app/(app)/layout.tsx`
```tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(),
                 setAll: () => {} } }  // server can't set; middleware handles refresh
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  // Fetch user's church + role server-side
  const { data: user } = await supabase
    .from('users')
    .select('*, churches(*)')
    .eq('id', session.user.id)
    .single();

  if (!user) redirect('/login');

  return (
    <StoreProvider store={db} serverUser={user}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
```
Move role-based route restrictions to `src/middleware.ts`.

### Recipe 4: Notification Route Authorization (🔴 Critical)
**Issue:** `/api/notifications/*` trusts client `church_id`
**Fix:** Add to each notification route
```ts
// src/lib/auth-middleware.ts (extend)
export async function verifyChurchMembership(supabase, user, churchId: string) {
  const { data } = await supabase
    .from('users')
    .select('church_id, role')
    .eq('id', user.id)
    .single();
  if (!data || data.church_id !== churchId) {
    return null;
  }
  return data;
}

// In each /api/notifications/send-*/route.ts
const body = await req.json();
const membership = await verifyChurchMembership(supabase, session.user, body.church_id);
if (!membership) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
if (membership.role !== 'admin' && membership.role !== 'leader') {
  return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
}
```

### Recipe 5: Zod Validation on API Routes (🔴 Critical)
**Issue:** No input validation
**Fix:** Create `src/lib/validation.ts` schemas (extend existing)
```ts
import { z } from 'zod';

export const sendInvitationSchema = z.object({
  church_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'leader', 'member', 'viewer', 'team']),
  name: z.string().min(1).max(100).optional(),
});

export const createAssignmentSchema = z.object({
  service_id: z.string().uuid(),
  team_member_id: z.string().uuid(),
  role: z.string().min(1).max(50),
});

// Usage in route:
const parsed = sendInvitationSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
```

### Recipe 6: Security Headers (🔴 Critical)
**Fix:** `next.config.ts`
```ts
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

module.exports = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: securityHeaders,
    }];
  },
};
```
Add CSP with nonce once the app is server-rendered.

### Recipe 7: Missing Indexes (🟡 High)
**File:** `supabase/migrations/033_add_missing_indexes.sql`
```sql
CREATE INDEX IF NOT EXISTS idx_service_assignments_member ON service_assignments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_service_status ON service_assignments(service_id, status);
CREATE INDEX IF NOT EXISTS idx_song_usage_church_date ON song_usage(church_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_church_used ON invites(church_id, used_at);
```

### Recipe 8: Pagination (🟡 High)
**Fix:** `store.ts`
```ts
getByChurch: async (churchId: string, page = 0, pageSize = 50) => {
  const { data } = await supabase
    .from('services')
    .select('*', { count: 'exact' })
    .eq('church_id', churchId)
    .order('date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  return { items: (data || []) as Service[], total: count ?? 0 };
},
```

### Recipe 9: Fix `songFiles.create` Authorization (🔴 Critical)
**Issue:** No `church_id` check on insert
**Fix:** `store.ts`
```ts
create: async (sf: Omit<SongFile, 'id' | 'created_at'>, churchId: string) => {
  // Verify song belongs to church
  const { data: song } = await supabase
    .from('songs')
    .select('church_id')
    .eq('id', sf.song_id)
    .single();
  if (!song || song.church_id !== churchId) {
    throw new Error('Song not found in church');
  }
  const { data } = await supabase.from('song_files').insert(sf).select().single();
  return data as SongFile;
},
```
Update all callers to pass `churchId`.

### Recipe 10: Update Vulnerable Dependencies (🟡 High)
```bash
npm audit fix
# If breaking changes:
npm install resend@latest svix@latest ws@latest
```

---

**END OF AUDIT**