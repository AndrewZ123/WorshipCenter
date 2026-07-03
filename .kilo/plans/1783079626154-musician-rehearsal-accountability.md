# Musician Rehearsal Accountability Feature

## Goal
Allow musicians to track practice progress for songs within a service using per-song checkboxes or a "Mark All Rehearsed" button. Band leaders see per-service rehearsal stats on the dashboard (e.g., "Drummer: 2/5 songs rehearsed").

## Design Decisions
- **Visibility gate:** Rehearsal tab is always available for any service (any status).
- **UI location:** New dedicated "Rehearsal" tab (6th tab) on the service detail page.
- **Dashboard scope:** Per-service breakdown (not aggregate across all services).
- **Rehearsal eligibility:** Only team members with a `service_assignment` for that service can toggle checkboxes. Leaders/admins see read-only stats.
- **Flexibility:** Any team member can view the tab; only assigned musicians can toggle.

---

## Task 1 — Database Migration

**File:** `supabase/migrations/034_add_rehearsal_logs.sql`

New table `rehearsal_logs`:
- `id UUID PK DEFAULT gen_random_uuid()`
- `church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE`
- `service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE`
- `team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE`
- `song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE`
- `rehearsed BOOLEAN NOT NULL DEFAULT false`
- `rehearsed_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `UNIQUE(service_id, team_member_id, song_id)` — prevents duplicates on re-toggle

Indexes on `service_id` and `team_member_id`.

**RLS policies:**
- `SELECT`: church-scoped (`church_id = get_user_church_id()`)
- `INSERT`: church-scoped AND `team_member_id` links to `auth.uid()` via `team_members.user_id` AND `team_member_id` has a `service_assignment` for this `service_id`
- `UPDATE`: same as INSERT
- `DELETE`: church-scoped AND `is_admin_or_leader()`

---

## Task 2 — Types

**File:** `src/lib/types.ts` — append:

```ts
export interface RehearsalLog {
  id: string;
  church_id: string;
  service_id: string;
  team_member_id: string;
  song_id: string;
  rehearsed: boolean;
  rehearsed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RehearsalStats {
  team_member_id: string;
  member_name: string;
  member_role: string;
  rehearsed_count: number;
  total_songs: number;
}
```

---

## Task 3 — Store Layer

**File:** `src/lib/store.ts` — add `db.rehearsals` section:

| Method | Inputs | Behavior |
|---|---|---|
| `getByService(serviceId, churchId)` | service, church IDs | Returns all rehearsal logs for a service (with team_member name join) |
| `getByTeamMember(serviceId, teamMemberId, churchId)` | service, member, church IDs | Returns logs for one musician in a service |
| `upsert(serviceId, teamMemberId, songId, rehearsed, churchId)` | all fields | `upsert` with `onConflict: 'service_id,team_member_id,song_id'`. Verifies assignment exists. Sets `rehearsed_at` when `rehearsed=true`, null when `false`. |
| `markAll(serviceId, teamMemberId, churchId)` | service, member, church IDs | Fetches current song-type service_items, calls `upsert` for each with `rehearsed=true` |
| `getStatsByService(serviceId, churchId)` | service, church IDs | Returns `RehearsalStats[]` — one entry per assigned member with counts. Denominator = current song items. |

**Edge cases:**
- `upsert` with `onConflict` prevents row duplication on re-toggle
- `markAll` iterates live `service_items` so newly added songs are included
- `getStatsByService` uses `Set<string>` for `song_id` to deduplicate
- If service has no song items or no assignments, returns `[]`

---

## Task 4 — RehearsalTab Component

**New file:** `src/components/services/RehearsalTab.tsx`

**Props:** `serviceId`, `churchId`, `teamMemberId` (string | null), `items` (ServiceItem[]), `songs` (Song[]), `isReadOnly` (boolean), `isLeader` (boolean)

**Layout:**
- Header row with "Song" + "Status" + "Rehearsed At"
- Filter `items` to `type === 'song'` only
- For each song: title, key badge, checkbox (checked = rehearsed), optional timestamp
- "Mark All Rehearsed" button at bottom (only for assigned musicians)

**Musician view** (teamMemberId is set AND user has an assignment for this service):
- Checkboxes are toggleable
- Click checkbox → optimistic UI toggle → call `db.rehearsals.upsert(…)`
- "Mark All" → confirm dialog → `db.rehearsals.markAll(…)`

**Leader view** (isLeader = true):
- Fetch `db.rehearsals.getStatsByService(serviceId, churchId)`
- Show a per-member progress table (name, role, rehearsed_count/total_songs)
- No toggleable controls

**Empty/other:**
- No song items → EmptyState
- Musician with no assignment → message "You are not assigned to this service. Rehearsal tracking is available for assigned musicians only."
- teamMemberId null + not leader → tab hidden (handled by parent)

---

## Task 5 — Integrate Tab into ServiceDetailClient

**File:** `src/app/(app)/services/[id]/ServiceDetailClient.tsx`

Changes:
1. Import `RehearsalTab`
2. Add 6th `<Tab>` in `TabList` after Chat tab:
   - Shown when `user.team_member_id` exists (musician) OR `user.role !== 'team'` (leader/admin)
   - Label: "Rehearsal" with `CheckSquare` icon
3. Add corresponding `<TabPanel>`:
   - Extract `teamMemberId` from `user.team_member_id`
   - Determine if user has an assignment: `assignments.some(a => a.team_member_id === user.team_member_id)`
   - Pass props to `<RehearsalTab>`
4. Pass `assignments` (loaded in `loadData`) as a prop or compute locally

---

## Task 6 — Dashboard Rehearsal Stats

**File:** `src/app/(app)/dashboard/page.tsx`

In `ServiceCard` component:
- New `useEffect` for leaders only (`user?.role !== 'team'`): load `db.rehearsals.getStatsByService(svc.id, church.id)`
- Render collapsed section below existing stats:

```
┌──────────────────────────────┐
│ Service Title          ●     │
│ Jan 15 · 9:00 AM             │
│ 4 songs · 45 min · 3 assigned│
│ ──────────────────────────── │
│ REHEARSAL PROGRESS           │
│ Sarah Johnson     3/4 [tag] │
│ Mike Torres       2/4 [tag] │
│ Dave Chen         4/4 [tag] │
└──────────────────────────────┘
```

- Tag color: green when `rehearsed_count === total_songs`, orange otherwise
- Only rendered when rehearsalStats.length > 0 and user is leader/admin

---

## Task 7 — Demo Data

**File:** `src/lib/demo/data.ts`
- Add `rehearsal_logs` array to the demo dataset with varied progress levels
- Link to existing demo services, team members, and song IDs

**File:** `src/lib/demo/store.ts`
- Add `rehearsals` section mirroring the real store API with in-memory operations

---

## Validation

1. `npx tsc --noEmit` — type check passes
2. Manual checklist:
   - Assigned musician sees checkboxes on Rehearsal tab; toggling persists on refresh
   - "Mark All Rehearsed" toggles all songs in one click
   - Leader dashboard shows per-member counts per service card
   - Adding a song after logs exist → new song shows unchecked, count adjusts
   - Removing a song → orphaned logs ignored in counts
   - Unassigned user sees read-only message
   - `team` role user does NOT see rehearsal stats on dashboard
