# WorshipCenter Feature Roadmap & Competitive Gameplan

> **Mission:** Match (and beat) a $200/mo competitor at a flat **$29/mo**, with every feature included — no caps, no paywalls, no upsells.

---

## 0. The Zero-Cost Principle (CRITICAL)

Because we charge only **$29/mo flat**, every feature in this roadmap must satisfy one hard rule:

> **Zero additional recurring cost.** No paid third-party APIs, no per-call charges, no per-user SaaS dependencies. Everything must run on infrastructure we already pay for: **Supabase** (Postgres + Realtime + Storage) and **Vercel** (Next.js hosting).

### What this rules out (and our free alternative)

| Tempting paid approach | Why we skip it | Free alternative we use instead |
|---|---|---|
| OpenAI/Anthropic API for "AI scheduling" | Per-token cost kills $29 economics | **Deterministic rotation algorithm** — no AI, no cost, arguably better reliability |
| Vimeo Pro / paid video hosting for training | Per-plan $$ | **YouTube embeds only** (free, unlimited) |
| SendGrid beyond free tier / paid SMS providers | Per-message cost at scale | **Resend free tier + Twilio trial** (already integrated; keep usage within free quotas) |
| Zapier paid app | Passes cost to us or user | **Native webhooks + public API** we build ourselves |
| Managed cron (e.g., cron-job.org paid) | Recurring fee | **Vercel Cron Jobs** (free on Hobby/Pro) or Supabase pg_cron (free) |
| Paid S3 for uploads | Per-GB cost | **Supabase Storage free tier** with strict per-church size caps |
| Third-party auth providers beyond what we have | Per-MAU cost | Supabase Auth (already in use) |

**The golden rule for this document:** if a feature cannot be delivered for $0/month in marginal infrastructure cost, we either redesign it to be free, or we don't build it.

---

## 1. Executive Summary

WorshipCenter already ships a remarkably complete worship-team platform: service planning with drag-and-drop ordering, team management with roles + RBAC, scheduling with a confirm/decline flow, automated email/SMS reminders, real-time church-wide and per-service chat, a full song library with rotation analytics, templates, and Stripe billing — all at $29/m flat with **unlimited members**.

The competitor charges up to **$200/m** and still gates member counts (50 / 100 / unlimited tiers) and reserves several high-value features behind that premium price. This document is the gameplan for closing the feature gap **selectively** — choosing only the features that (a) genuinely help small-to-mid churches, (b) build on what we already have, (c) reinforce the "everything for $29" positioning, and **(d) cost us nothing extra to run**.

**Guiding principles for feature selection:**

1. **Build on existing infrastructure first.** If a feature reuses our Supabase schema, reminders engine, and chat layer, it ships fast, stays reliable, and adds $0 to our costs.
2. **Win on simplicity + price, not on feature sprawl.** We don't copy every niche audio-engineering tool (SPL meters, RTA graphs, Smaart integration). We pick features that the *typical* church actually uses.
3. **Every Tier-1 feature must be marketable.** Each one becomes a line on the pricing page.
4. **Zero marginal cost, always.** No feature ships if it requires a paid API or a per-user subscription.

---

## 2. Feature Comparison Matrix

Legend: ✅ have now · 🟡 planned (see phases below) · ❌ not pursuing / deliberately skipped

### Member Management

| Feature | Competitor | WorshipCenter |
|---|---|---|
| Invite team | ✅ (capped 50/100) | ✅ **Unlimited** |
| Admin & user permissions | ✅ | ✅ RBAC (admin/leader/team) |
| Member groups | ✅ | 🟡 Phase 1 |
| Private notes | ✅ | 🟡 Phase 1 |

### Team Messaging

| Feature | Competitor | WorshipCenter |
|---|---|---|
| Direct messages + group chats | ✅ | ✅ Real-time chat |
| Joinable channels (team/position) | ✅ | 🟡 Phase 1 |
| Share links, files, images, video | ✅ | 🟡 Phase 2 (capped storage) |
| Scheduled sends | ✅ | 🟡 Phase 2 (free cron) |
| Auto-create chats from Planning Center | ✅ | 🟡 Phase 3 (PCO) |
| Audit message history & edits | ✅ | 🟡 Phase 2 |

### Tasks & Checklists

| Feature | Competitor | WorshipCenter |
|---|---|---|
| One-off or recurring tasks | ✅ | 🟡 Phase 1 |
| One-off or recurring checklists | ✅ | 🟡 Phase 1 |
| Auto-assign to scheduled positions | ✅ | 🟡 Phase 1 |
| Completion analytics | ✅ | 🟡 Phase 2 |

### Live Service Dashboard

| Feature | Competitor | WorshipCenter |
|---|---|---|
| View/control program slides | ✅ (ProPresenter) | ❌ Skip (niche) |
| Manage/track order of service (live) | ✅ | 🟡 Phase 2 "Service Mode" |
| Service timers | ✅ | 🟡 Phase 2 |
| Embed service livestream | ✅ | 🟡 Phase 2 |
| SPL meter & RTA graph | ✅ | ❌ Skip (niche AV) |
| Livestream viewer metrics | ✅ | ❌ Skip (low demand) |
| Detailed service reports | ✅ | 🟡 Phase 2 |

### Patch Sheets

| Feature | Competitor | WorshipCenter |
|---|---|---|
| Visual/labeled signal routing | ✅ (soon) | ❌ Skip — niche |
| Drag-and-drop routing | ✅ (soon) | ❌ Skip |
| AI-import existing sheets | ✅ (soon) | ❌ Skip (would need paid OCR/AI) |

> **Patch sheets are explicitly out of scope.** They serve large production environments and would dilute our small-church focus.

### Integrations

| Integration | Competitor | WorshipCenter |
|---|---|---|
| **Planning Center** | ✅ | 🟡 Phase 3 (top priority, free OAuth REST API) |
| YouTube | ✅ | ✅ (song + training embeds) |
| ProPresenter | ✅ | ❌ Skip for now |
| Facebook / Resi | ✅ | ❌ Skip for now |
| Smaart / Shure / Sennheiser | ✅ | ❌ Skip (hardware-specific) |
| ProdCom / Rock RMS | ❌ | ❌ Skip |
| Zapier | ✅ | 🟡 Phase 3 (we build webhooks; users connect via free Zapier tier) |
| Webhooks & API access | ✅ | 🟡 Phase 3 |

### Multi-Campus

| Feature | Competitor | WorshipCenter |
|---|---|---|
| Campus-specific permissions | ✅ | 🟡 Phase 4 (wait for demand) |
| Per-campus training & pathways | ✅ | 🟡 Phase 4 |
| Centralized dashboards | ✅ | 🟡 Phase 4 |
| Campus chats & channels | ✅ | 🟡 Phase 1 (channels) → Phase 4 (campus scoping) |

### Custom Branding

| Feature | Competitor | WorshipCenter |
|---|---|---|
| Custom church domain | ✅ | 🟡 Phase 4 |
| Custom colors & fonts | ✅ | 🟡 Phase 4 |
| Custom iOS/Android app | ✅ | 🟡 Phase 4 |

### Automated Scheduling

| Feature | Competitor | WorshipCenter |
|---|---|---|
| Schedule positions with AI | ✅ (soon) | 🟡 Phase 3 (**deterministic rotation, no paid AI**) |
| AI manages declines/unconfirmed | ✅ (soon) | 🟡 Phase 3 (**auto-escalation via existing reminders**) |
| Sync schedules with PCO | ✅ (soon) | 🟡 Phase 3 |

### Training Videos & Pathways

| Feature | Competitor | WorshipCenter |
|---|---|---|
| 1000+ training videos | ✅ | 🟡 Phase 2 (**curated, not 1000+**) |
| Custom uploads | ✅ | 🟡 Phase 2 (**capped storage**) |
| YouTube embeds | ✅ | ✅ (songs) → extend to training |
| Customizable courses | ✅ | 🟡 Phase 2 |
| Automated pathways (role templates) | ✅ | 🟡 Phase 3 |
| Enrollment forms | ✅ | 🟡 Phase 3 |
| Update PCO profiles | ✅ | 🟡 Phase 3 |
| Course quizzes | ✅ | 🟡 Phase 3 |

---

## 3. The Four Phases

### PHASE 1 — "Foundation & Fairness" (Weeks 1–8)

**Goal:** Close the most painful competitive gaps quickly by extending what we already own. Every item here costs **$0 extra** because it's pure Postgres rows + existing UI patterns.

---

#### 1.1 Tasks & Checklists ⭐ (highest priority)

**Cost: $0** — just new tables in our existing Supabase instance.

**Why first:** This is the single most-requested gap. Every service has setup, sound-check, and teardown tasks that today live in a worship leader's head or in a separate shared note. Adding it makes WorshipCenter a true "service-day operations" tool.

**User stories**
- As a worship leader, I can create a one-off task attached to a service ("Buy extra batteries for in-ears").
- As a worship leader, I can create a reusable checklist template ("Sunday Setup Checklist") and attach it to any service.
- As a worship leader, I can auto-assign a checklist to a *role* (e.g., "Sound Tech"), so whoever is scheduled as Sound Tech for that service inherits the items.
- As a team member, I see my assigned tasks in a "My Tasks" view and check them off.
- As a worship leader, I see completion progress on the service detail page.

**Data model changes (new tables)**
```sql
-- Task/checklist templates (reusable)
CREATE TABLE task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  recurrence text,              -- 'one_off' | 'per_service' | 'weekly'
  role_scope text,              -- optional: auto-assign to a role
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE task_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES task_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  position int NOT NULL DEFAULT 0,
  is_required boolean DEFAULT true
);

-- Instantiated tasks attached to a specific service
CREATE TABLE service_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  church_id uuid REFERENCES churches(id) ON DELETE CASCADE,
  template_id uuid REFERENCES task_templates(id),
  title text NOT NULL,
  notes text,
  assigned_team_member_id uuid REFERENCES team_members(id),
  assigned_role text,                              -- e.g., 'sound_tech'
  position int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',          -- pending|in_progress|done|skipped
  completed_at timestamptz,
  due_offset_minutes int,                          -- minutes relative to service start
  created_at timestamptz DEFAULT now()
);
```

**Affected files (new + modified)**
- `supabase/migrations/021_create_tasks_tables.sql` (new)
- `src/lib/types.ts` — add `Task`, `TaskTemplate`, `TaskTemplateItem`, `ServiceTask`
- `src/lib/store.ts` — add `db.tasks`, `db.taskTemplates` CRUD (mirror existing `db.assignments` pattern with church_id scoping)
- `src/app/(app)/services/[id]/ServiceDetailClient.tsx` — add a "Tasks" tab (5th tab) next to Chat
- `src/components/services/ServiceTasks.tsx` (new) — task board for a service
- `src/app/(app)/tasks/page.tsx` (new) — "My Tasks" global view
- `src/app/(app)/dashboard/page.tsx` — show "X tasks due this week" widget
- `src/app/demo/services/[id]/ClientPage.tsx` + demo data — seed sample tasks so the demo sells the feature
- RLS policies in the migration (church-scoped, like all our tables)

**Reminder integration**
- Extend `src/lib/reminders.ts` to optionally fire on a `due_offset_minutes` threshold. Reuses the existing email/SMS pipeline — no new infrastructure.

**Effort:** ~3 weeks (1 dev). One of the highest ROI items on the list.

---

#### 1.2 Member Groups / Bands

**Cost: $0** — two small tables.

**Why:** Worship leaders constantly reuse the same 5–8 people ("Sunday Morning Team", "Youth Band"). Letting them save a group and one-click assign the whole group to a service is a big time-saver.

**Data model**
```sql
CREATE TABLE member_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE member_group_members (
  group_id uuid REFERENCES member_groups(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  role text,
  PRIMARY KEY (group_id, team_member_id)
);
```

**Affected files**
- `supabase/migrations/022_create_member_groups.sql`
- `src/lib/types.ts` — `MemberGroup`
- `src/lib/store.ts` — `db.memberGroups`
- `src/app/(app)/team/page.tsx` — add a "Groups" tab
- `src/app/(app)/services/[id]/ServiceSchedule.tsx` — "Assign Group" button that loops `db.assignments.create` for each member

**Effort:** ~1 week.

---

#### 1.3 Member Private Notes

**Cost: $0** — one small table.

**Why:** A small but loved feature. Worship leaders want to jot "great at harmonies" or "needs transportation help" privately — visible only to admins/leaders, never to the member themselves.

**Data model**
```sql
CREATE TABLE team_member_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id),
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Affected files**
- `supabase/migrations/023_create_member_notes.sql`
- `src/app/(app)/team/[id]/TeamMemberDetailClient.tsx` — "Private Notes" section (admin/leader gated via `usePermissions`)

**Effort:** ~3 days.

---

#### 1.4 Chat Channels

**Cost: $0** — extends existing Supabase Realtime chat tables.

**Why:** Today all church chat is one global room. Role-based channels ("Vocals", "Band", "Tech Team") plus optional direct messages mirror how teams actually communicate and is one of the competitor's headline features.

**Data model**
```sql
CREATE TABLE chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'channel',   -- 'channel' | 'dm'
  role_scope text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE chat_channel_members (
  channel_id uuid REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

ALTER TABLE chat_messages ADD COLUMN channel_id uuid REFERENCES chat_channels(id) ON DELETE CASCADE;
```

**Affected files**
- `supabase/migrations/024_create_chat_channels.sql`
- `src/lib/types.ts` — `ChatChannel`
- `src/lib/store.ts` — `db.channels`
- `src/app/(app)/chat/page.tsx` — left sidebar list of channels + DMs; main pane scoped to selected channel
- `src/components/services/ServiceChat.tsx` — refactor to accept a `channelId`, so service chat becomes "just another channel"
- Auto-create a default `#general`, `#vocals`, `#band`, `#tech` channel set on church signup

**Effort:** ~2 weeks.

---

### PHASE 2 — "Service-Day Operations & Growth" (Weeks 9–20)

#### 2.1 Service Mode (Live Dashboard, Simplified)

**Cost: $0** — frontend-only, no new backend.

**Why:** On Sunday morning, the worship leader needs a clean, glanceable view of *where we are in the service*. We deliberately skip the competitor's ProPresenter slide control and SPL meter.

**Scope (MVP)**
- "Enter Service Mode" button on the service detail page → full-screen, distraction-free view.
- Current item highlighted, next 2 items previewed, previous item grayed.
- Up/down arrows (or swipe on mobile) to advance.
- Countdown timer per item (when `duration_minutes` set) + a global "service elapsed" timer.
- Optional YouTube/livestream embed panel (free iframe).
- "Run sheet" export to PDF for printing (client-side via `window.print()` or a free JS lib).

**Out of scope (deliberately):** slide control, SPL/RTA, viewer metrics, ProPresenter.

**Affected files**
- `src/app/(app)/services/[id]/ServiceMode/page.tsx` (new, full-screen route)
- `src/components/services/ServiceTimer.tsx` (new)
- Reuse `store.serviceItems` — no schema change needed.

**Effort:** ~2 weeks.

---

#### 2.2 Service Reports & Enhanced Analytics

**Cost: $0** — aggregation queries against data we already collect.

**Why:** Worship leaders get asked "how's the team doing?" by pastors/elders. We already collect the data (assignments, confirm/decline, song usage) — we just need to surface it.

**Reports to include**
- **Team participation:** per-member service count over a date range.
- **Response health:** avg time to confirm, % declined, % no-response (reuses `confirmed_at` / `declined_at` columns already in `service_assignments`).
- **Song usage:** (already exists in `/usage`) — extend with date filters + CSV export.
- **Task completion rate** (depends on Phase 1 tasks).
- **Service completion:** # services planned vs. finalized vs. completed.

**Affected files**
- `src/app/(app)/usage/page.tsx` — expand the existing scaffold
- `src/app/(app)/reports/page.tsx` (new) — dedicated reports hub with date range picker
- New aggregation: prefer Postgres views or RPC functions in a migration over N+1 client queries.

**Effort:** ~2–3 weeks.

---

#### 2.3 Training Hub (Lightweight)

**Cost: $0** — YouTube embeds are free; uploads capped within Supabase Storage free tier.

**Why:** The competitor brags "1,000+ videos" — but most churches just need a small, organized library for onboarding new volunteers. We ship a curated, role-tagged video library at a fraction of the cost and frame it as "focused, not bloated."

**Scope (MVP)**
- New "Training" top-level nav item.
- Videos organized by **role** (Vocals, Guitar, Drums, Keys, Sound, Media) and **level** (Beginner / Intermediate / Advanced).
- Sources: **YouTube embeds only** (free, unlimited). Custom uploads optional but capped (e.g., 500 MB per church) to stay within Supabase Storage free tier.
- Worship leader can create a "Course" = ordered playlist of videos.
- Progress tracking: mark video as watched (per user).

**Out of scope for MVP (defer to Phase 3):** quizzes, automated pathways, enrollment forms, PCO profile writes.

**Data model**
```sql
CREATE TABLE training_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches(id) ON DELETE CASCADE,   -- null = global/curated
  title text NOT NULL,
  description text,
  source text NOT NULL,                -- 'youtube' | 'upload'
  source_url text,
  storage_path text,                   -- for uploads (capped)
  duration_seconds int,
  role_tags text[],
  level text,                          -- 'beginner'|'intermediate'|'advanced'
  created_at timestamptz DEFAULT now()
);

CREATE TABLE training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE training_course_videos (
  course_id uuid REFERENCES training_courses(id) ON DELETE CASCADE,
  video_id uuid REFERENCES training_videos(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (course_id, video_id)
);

CREATE TABLE training_progress (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  video_id uuid REFERENCES training_videos(id) ON DELETE CASCADE,
  watched boolean DEFAULT false,
  watched_at timestamptz,
  PRIMARY KEY (user_id, video_id)
);
```

**Affected files**
- `supabase/migrations/025_create_training_tables.sql`
- `src/app/(app)/training/page.tsx` (new) + `src/app/(app)/training/[videoId]/page.tsx`
- `src/app/(app)/training/courses/page.tsx` + `[id]/page.tsx`
- Add "Training" link in `src/components/layout/AppShell.tsx`
- Seed a curated global library (we ship ~30–50 hand-picked YouTube videos to start).

**Effort:** ~3 weeks for MVP.

---

#### 2.4 Enhanced Messaging (Scheduled Sends, File Sharing, Edit Audit)

**Cost: $0** — Supabase Storage free tier for attachments; Vercel Cron for scheduled sends.

**Why:** Brings chat to competitor parity on the small details that matter once channels exist.

**Scope**
- **Scheduled sends:** compose a message, pick a send time, store in DB, fire via **Vercel Cron** (free). Great for "Sunday morning reminder" messages.
- **File/image attachments:** Supabase Storage upload (free tier with **per-church cap**, e.g., 100 MB), inline preview for images, download link for files.
- **Message edit history:** `message_edit_history` table; "edited" indicator + click to see prior versions.

**Data model**
```sql
ALTER TABLE chat_messages ADD COLUMN scheduled_for timestamptz;
ALTER TABLE chat_messages ADD COLUMN edited_at timestamptz;
ALTER TABLE chat_messages ADD COLUMN deleted_at timestamptz;

CREATE TABLE message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint
);

CREATE TABLE message_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  previous_body text,
  edited_by uuid REFERENCES users(id),
  edited_at timestamptz DEFAULT now()
);
```

**Affected files**
- `supabase/migrations/026_enhance_chat.sql`
- `src/components/services/ServiceChat.tsx` — attachment UI, edit/delete affordances
- `vercel.json` — add a cron entry: `{"crons": [{"path": "/api/cron/send-scheduled", "schedule": "* * * * *"}]}`
- `src/app/api/cron/send-scheduled/route.ts` (new) — runs every minute, sends due scheduled messages

**Effort:** ~2 weeks.

---

### PHASE 3 — "Ecosystem & Automation" (Weeks 21–36)

This phase removes the #1 reason churches pick the competitor: deep integrations and scheduling automation — all **at $0 marginal cost**.

#### 3.1 Planning Center Integration ⭐ (biggest competitive catch-up)

**Cost: $0** — Planning Center's REST API is free; OAuth is free; no per-call charges.

**Strategy:** Start with **one-way import** (read-only from PCO), then graduate to two-way sync.

**Phases within the integration**
1. **OAuth connection** — "Connect Planning Center" in Settings → Integrations. Store refresh tokens per church.
2. **Import people** — pull PCO people into `team_members` (match by email).
3. **Import plans** — pull a PCO plan into a WorshipCenter service (items, songs, team assignments).
4. **Two-way sync (later)** — push WorshipCenter assignment statuses back to PCO.

**Data model**
```sql
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES churches(id) ON DELETE CASCADE,
  provider text NOT NULL,                 -- 'planning_center'
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb,
  connected_at timestamptz DEFAULT now(),
  UNIQUE (church_id, provider)
);

CREATE TABLE integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integrations(id) ON DELETE CASCADE,
  entity_type text,
  direction text,                         -- 'import' | 'export'
  status text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Affected files**
- `supabase/migrations/027_create_integrations.sql`
- `src/lib/integrations/planningCenter.ts` (new) — OAuth + API client
- `src/app/api/integrations/pco/callback/route.ts` (new)
- `src/app/(app)/settings/integrations/page.tsx` (new)
- "Import from Planning Center" button on `src/app/(app)/services/page.tsx`

**Effort:** ~5–6 weeks. **Highest business value on the roadmap.**

---

#### 3.2 Webhooks & Public API

**Cost: $0** — we build it ourselves; no Zapier partnership needed.

**Why:** Lets technically-minded churches connect WorshipCenter to anything. Users on Zapier's free tier can connect via our webhooks.

**Scope**
- Generate per-church API keys in Settings.
- Public REST API (read-only first): services, team, songs, assignments.
- Webhook subscriptions: emit events (`service.created`, `assignment.confirmed`, `task.completed`, `message.posted`) to user-configured URLs with HMAC signing.

**Affected files**
- `supabase/migrations/028_create_api_keys_and_webhooks.sql`
- `src/app/api/v1/...` — public API routes (separate from internal `/api/`)
- `src/lib/webhooks.ts` — dispatch helper
- `src/app/(app)/settings/api/page.tsx`

**Effort:** ~3 weeks.

---

#### 3.3 Smart Rotation Scheduling (NO paid AI)

**Cost: $0** — pure Postgres queries; **no LLM, no OpenAI, no Anthropic.**

**Why:** The competitor's "coming soon" AI scheduling is a strong marketing hook. But we don't need paid AI — we need a **deterministic rotation algorithm** that respects fairness. This is arguably *better* than AI because it's predictable and explainable.

**How it works (no ML required)**
1. When a leader schedules a role for a service, we query `service_assignments` for every team member who can fill that role.
2. We rank them by: (a) fewest services served in the last 90 days, (b) longest time since last service, (c) no active blackout date.
3. We present the top suggestion with a one-click "assign" button.
4. "Auto-fill service" applies this to every required role at once.
5. **Auto-escalation:** if an assignment is declined or unconfirmed after X days, the existing reminders pipeline (`src/lib/reminders.ts`) automatically asks the next-ranked member. No AI, just a queue.

**Data model**
```sql
-- deterministic rotation view (no ML)
CREATE VIEW member_role_stats AS
  SELECT team_member_id, role,
         count(*) FILTER (WHERE status='confirmed') as confirmed_count,
         max(confirmed_at) as last_served_at
  FROM service_assignments
  GROUP BY team_member_id, role;

CREATE TABLE blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  reason text
);
```

**Affected files**
- `supabase/migrations/029_rotation_and_blackouts.sql`
- `src/lib/scheduling/suggest.ts` (new) — deterministic rotation algorithm
- "Suggest" button in `ServiceSchedule.tsx`
- Extend `src/lib/reminders.ts` for auto-escalation on declined/unconfirmed

**Effort:** ~2 weeks (no LLM integration = faster, cheaper, more reliable).

---

#### 3.4 Training Pathways & Quizzes (extends Phase 2 hub)

**Cost: $0** — DB rows only; quiz logic is trivial server-side.

**Why:** Onboarding new volunteers end-to-end. Pathways = ordered courses assigned per role with due dates and emails.

**Scope**
- Pathway templates per role (e.g., "New Sound Tech Pathway": 3 videos + 1 quiz).
- Customizable onboarding emails (reuse existing email pipeline).
- Simple quizzes (multiple choice) with pass threshold — stored as JSONB, scored server-side.
- "Enrollment form" — a lightweight form that auto-enrolls the submitter into the right pathway.
- Update Planning Center profiles with completed pathways (depends on 3.1).

**Effort:** ~4 weeks.

---

### PHASE 4 — "Scale & Premium" (Weeks 37+, demand-driven)

Only build these when customers explicitly ask. They add operational complexity.

#### 4.1 Multi-Campus

**Cost: $0** — schema migration only.

- Add `campus_id` column to `churches` (or a new `campuses` table).
- Scope team_members, services, channels, tasks by campus.
- "Centralized dashboards" = aggregate across campuses for multi-campus admins.

**Trigger to build:** a paying customer with 2+ campuses requests it.

---

#### 4.2 Custom Branding & White-Label

**Cost: $0–low** — theme override is a DB column; custom domains use Vercel's free wildcard domain feature.

- Custom subdomain (`church.worshipcenter.app`) via Vercel wildcard routing (free).
- Theme override (primary color, logo, fonts) stored on `churches` as a JSONB column.
- White-label iOS/Android build via existing Capacitor config per church.

**Note:** This could justify introducing a **$49/m Pro tier** to capture upsell revenue from larger churches — but the $29 tier remains the unbeatable small-church offer.

---

#### 4.3 Additional Integrations (on request)

ProPresenter, Resi, Rock RMS. Build only when ≥3 customers ask for a specific one. The Webhooks/API from Phase 3 covers most long-tail needs in the meantime.

---

## 4. What We're Deliberately NOT Building

Clarity is a feature. Saying no to these keeps the product focused, the price at $29, and our costs at $0:

| Skipped Feature | Reason |
|---|---|
| Patch sheets / signal routing | Niche AV-engineering tool; out of our small-church sweet spot |
| SPL meter / RTA graph | Hardware-adjacent; tiny audience |
| ProPresenter slide control | Deep, fragile integration; most churches run ProPresenter standalone fine |
| Livestream viewer metrics | Better served by YouTube/Resi dashboards directly |
| Smaart / Shure / Sennheiser integrations | Hardware-specific; not worth the maintenance |
| 1,000+ curated training videos | A focused 30–50 video library beats a bloated 1,000-video dump |
| Paid LLM-based "AI scheduling" | Per-token cost violates our zero-cost rule; deterministic rotation is better anyway |

---

## 5. Implementation Order & Dependencies

```
Phase 1 (parallel tracks, all $0)
├── Tasks & Checklists        (independent)         → enables Phase 2 reports
├── Member Groups / Bands     (independent)
├── Private Notes             (independent)
└── Chat Channels             (independent)          → enables Phase 2 messaging

Phase 2 (depends on Phase 1, all $0)
├── Service Mode              (needs service items — already have)
├── Service Reports           (needs tasks from Phase 1 for full value)
├── Training Hub (MVP)        (independent of others)
└── Enhanced Messaging        (needs channels from Phase 1)

Phase 3 (depends on Phases 1–2 being stable, all $0)
├── Planning Center           (independent, highest value)
├── Webhooks & API            (independent)
├── Smart Rotation            (uses assignment data; NO paid AI)
└── Training Pathways         (needs Training Hub from Phase 2)

Phase 4 (demand-driven, all $0)
├── Multi-Campus              (schema migration across all tables)
├── Custom Branding           (consider optional $49 Pro tier)
└── Long-tail Integrations    (ProPresenter, Resi, etc.)
```

---

## 6. Marketing Positioning Notes

These talking points should flow into `worshipcenter-web` landing copy as each phase ships.

### Core message
> **"Everything the other guys charge $200/mo for — at $29. No caps. No upsells."**

### Phase 1 shipping bullets
- ✅ Drag-and-drop service planning (already have)
- ✅ Unlimited team members (already have — competitor caps at 50/100)
- ✅ Real-time team chat (already have)
- ✅ Service-day tasks & checklists — **new**
- ✅ Member groups & bands — **new**
- ✅ Role-based chat channels — **new**

### Phase 2 shipping bullets
- ✅ Live "Service Mode" with timers
- ✅ Service reports & team analytics
- ✅ Focused training library (curated, not bloated)
- ✅ Scheduled messages & file sharing

### Phase 3 shipping bullets
- ✅ **Planning Center import** — the #1 requested integration
- ✅ Public API + webhooks (connect to anything)
- ✅ Smart scheduling that respects rotation & blackouts
- ✅ Role-based training pathways with quizzes

### Price-comparison framing
| | Competitor | WorshipCenter |
|---|---|---|
| Monthly price | up to **$200** | **$29** |
| Member cap | 50 / 100 / unlimited tier | **Unlimited, always** |
| Feature paywalls | Yes (training, branding, API) | **None** |
| Real-time chat | ✅ | ✅ |
| Tasks & checklists | ✅ | ✅ |
| Planning Center sync | ✅ | ✅ (Phase 3) |
| Training | 1000+ videos | Focused library + your own |
| Smart scheduling | "AI" (soon) | ✅ Deterministic rotation (now) |

### Recommended landing-page additions (for `worshipcenter-web`)
- New **"Compared to $200/mo tools"** section on the pricing page.
- A side-by-side checklist (our checks vs. their caps).
- A dedicated **"Planning Center Integration"** page once Phase 3.1 ships.
- Update `src/components/home/Features.tsx` and `Pricing.tsx` to surface the new feature bullets each phase.

---

## 7. Suggested Sprint Plan (8-week cycles)

| Sprint | Weeks | Deliverables |
|---|---|---|
| S1 | 1–3 | Tasks & Checklists (1.1) end-to-end + demo data |
| S2 | 4–5 | Member Groups (1.2) + Private Notes (1.3) |
| S3 | 6–8 | Chat Channels (1.4) + Phase-1 marketing rollout |
| S4 | 9–10 | Service Mode (2.1) |
| S5 | 11–13 | Service Reports (2.2) |
| S6 | 14–16 | Training Hub MVP (2.3) |
| S7 | 17–18 | Enhanced Messaging (2.4) |
| S8 | 19–20 | Phase-2 polish + marketing rollout |
| S9 | 21–26 | Planning Center Integration (3.1) |
| S10 | 27–29 | Webhooks & API (3.2) |
| S11 | 30–31 | Smart Rotation (3.3) |
| S12 | 32–36 | Training Pathways (3.4) + Phase-3 rollout |

---

## 8. Cost Summary (Recurring Monthly)

| Infrastructure | Plan | Cost |
|---|---|---|
| Vercel | Hobby/Pro | $0–20 |
| Supabase | Free/Pro | $0–25 |
| Resend (email) | Free tier (3k/mo) | $0 |
| Twilio (SMS) | Trial/usage-based | $0–minimal |
| Stripe | Per-transaction only | % of revenue |
| Planning Center API | Free REST API | $0 |
| Domain | Annual | ~$1/mo amortized |
| **Total fixed** | | **~$0–45/mo** |

At $29/mo per church with even **5 paying customers** ($145/mo revenue), we're profitable. Every feature in this roadmap keeps that math intact.

---

*Last updated: 2026-01-01 · Owner: Andrew Zompa*