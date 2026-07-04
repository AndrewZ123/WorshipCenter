# Volunteer Preferences & Blockout Dates

## Overview

Two new features:
1. **Frequency preference** — max services per week a member wants to serve
2. **Blockout dates** — date ranges when a member is unavailable

Two access points:
- **Settings page** — team members manage their own preferences/blockouts (self-service)
- **Team Member Detail page** — admins/leaders manage for any member

Blockout conflicts are surfaced as **warnings** (not hard blocks) in both the bulk-add panel and the existing assignment list in `ServiceSchedule`.

---

## Step 1: Database Migration

New file: `supabase/migrations/039_add_volunteer_preferences.sql`

```sql
-- team_member_preferences (1:1 with team_members)
CREATE TABLE team_member_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  max_weekly_frequency INT CHECK (max_weekly_frequency IS NULL OR max_weekly_frequency BETWEEN 1 AND 7),
  availability_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_member_id)
);

-- team_member_blockout_dates
CREATE TABLE team_member_blockout_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blockout_dates_member_dates
  ON team_member_blockout_dates(team_member_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_blockout_dates_church
  ON team_member_blockout_dates(church_id);
CREATE INDEX IF NOT EXISTS idx_preferences_team_member
  ON team_member_preferences(team_member_id);
CREATE INDEX IF NOT EXISTS idx_preferences_church
  ON team_member_preferences(church_id);

-- RLS
ALTER TABLE team_member_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_blockout_dates ENABLE ROW LEVEL SECURITY;

-- Church-scoped SELECT (all church members can view)
CREATE POLICY "Preferences viewable by church members"
  ON team_member_preferences FOR SELECT
  USING (church_id = get_user_church_id());

CREATE POLICY "Blockout dates viewable by church members"
  ON team_member_blockout_dates FOR SELECT
  USING (church_id = get_user_church_id());

-- Only admin/leader can INSERT/UPDATE/DELETE
CREATE POLICY "Preferences insert for admin/leader"
  ON team_member_preferences FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Preferences update for admin/leader"
  ON team_member_preferences FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Blockout dates insert for admin/leader"
  ON team_member_blockout_dates FOR INSERT
  WITH CHECK (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Blockout dates update for admin/leader"
  ON team_member_blockout_dates FOR UPDATE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

CREATE POLICY "Blockout dates delete for admin/leader"
  ON team_member_blockout_dates FOR DELETE
  USING (church_id = get_user_church_id() AND is_admin_or_leader());

-- updated_at trigger for preferences
CREATE OR REPLACE FUNCTION update_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_preferences_updated
  BEFORE UPDATE ON team_member_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_preferences_timestamp();

COMMENT ON TABLE team_member_preferences IS 'Per-member preferences: max frequency and availability notes';
COMMENT ON TABLE team_member_blockout_dates IS 'Date ranges when a team member is unavailable';
```

---

## Step 2: TypeScript Types

File: `src/lib/types.ts`

Add after `TeamMember` interface:

```typescript
export interface TeamMemberPreference {
  id: string;
  team_member_id: string;
  church_id: string;
  max_weekly_frequency: number | null;
  availability_notes: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberBlockoutDate {
  id: string;
  team_member_id: string;
  church_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
}
```

---

## Step 3: Store Layer

File: `src/lib/store.ts`

Add two new store modules following existing patterns:

### `preferences`
- `getByTeamMember(teamMemberId, churchId)` → `TeamMemberPreference | null` (single row)
- `upsert(data, churchId)` → `TeamMemberPreference` (upsert by unique `team_member_id`)
- Sanitize `availability_notes`

### `blockoutDates`
- `getByTeamMember(teamMemberId, churchId)` → `TeamMemberBlockoutDate[]`
- `getByChurch(churchId)` → `TeamMemberBlockoutDate[]` (all blockouts for the church — used by ServiceSchedule for conflict checks)
- `create(data, churchId)` → `TeamMemberBlockoutDate`
- `delete(id, churchId)` → `boolean`

Both verify church_id against `team_members` table (same pattern as other store methods).

---

## Step 4: Demo Store

Files: `src/lib/demo/context.tsx`, `src/lib/demo/store.ts`

- Add `preferences: TeamMemberPreference[]` and `blockoutDates: TeamMemberBlockoutDate[]` to `DemoContextType` and state arrays
- Add methods: `upsertPreference`, `createBlockoutDate`, `deleteBlockoutDate`
- Wire through the demo store wrapper in `demo/store.ts`

---

## Step 5: Settings Page — Self-Service UI

File: `src/app/(app)/settings/page.tsx`

Insert a **"My Availability"** card between Church Settings and Support. Conditionally rendered when `user?.team_member_id` is set.

Contains:
- **Max Weekly Frequency**: number input (1–7) with a checkbox "No limit" that clears the value
- **Availability Notes**: `Textarea`
- **Save** button (calls `store.preferences.upsert`)
- **Blockout Dates** section:
  - Existing blockouts listed as cards showing date range + reason + delete button
  - Add form: two date inputs (start, end) + text input (reason) + "Add" button (calls `store.blockoutDates.create`)

---

## Step 6: Team Member Detail Page — Admin/Leader UI

File: `src/app/(app)/team/[id]/TeamMemberDetailClient.tsx`

Insert a **"Preferences & Availability"** section between the profile card (after line ~292) and the Recent Services section.

Same fields as the settings page, but:
- Uses the member's `id` from the URL instead of `user.team_member_id`
- Has an `isReadOnly` guard (hide edit controls for `role === 'team'`)

---

## Step 7: ServiceSchedule — Blockout Conflict Warnings

File: `src/components/services/ServiceSchedule.tsx`

On mount, fetch all blockout dates for the church via `store.blockoutDates.getByChurch(churchId)`.

### Bulk-add panel
When rendering each member in the team member list, check `isBlockedOut(member.id)`. If true, append an orange warning line:
> ⚠️ Blocked out Jul 12–18

### Existing assignment list
For each rendered assignment, if the member is blocked out for the service date, add a small orange warning indicator (e.g., `StatusBadge` with a custom "blocked" mapping, or an orange dot with tooltip showing the blockout reason/dates).

Helper function:
```typescript
const isBlockedOut = (memberId: string): TeamMemberBlockoutDate | undefined => {
  const svcDate = new Date(service.date + 'T00:00:00');
  return blockoutDates.find(b =>
    b.team_member_id === memberId &&
    new Date(b.start_date + 'T00:00:00') <= svcDate &&
    new Date(b.end_date + 'T00:00:00') >= svcDate
  );
};
```

---

## Files Created / Modified

| File | Action |
|---|---|
| `supabase/migrations/039_add_volunteer_preferences.sql` | **Create** |
| `src/lib/types.ts` | **Edit** — add 2 interfaces |
| `src/lib/store.ts` | **Edit** — add `preferences` & `blockoutDates` modules |
| `src/lib/demo/context.tsx` | **Edit** — add state + methods |
| `src/lib/demo/store.ts` | **Edit** — add store bridge methods |
| `src/app/(app)/settings/page.tsx` | **Edit** — add "My Availability" card |
| `src/app/(app)/team/[id]/TeamMemberDetailClient.tsx` | **Edit** — add "Preferences & Availability" section |
| `src/components/services/ServiceSchedule.tsx` | **Edit** — blockout conflict warnings |

---

## Validation

1. Migration runs cleanly: `supabase migration up`
2. RLS prevents cross-church access (test with different church contexts)
3. Settings page loads & saves preferences for the logged-in user
4. Admin can view/edit any member's preferences from the team detail page
5. ServiceSchedule shows orange warnings for members with conflicting blockout dates (both in bulk-add and existing assignments)
6. Demo mode works with the new features (no console errors)
