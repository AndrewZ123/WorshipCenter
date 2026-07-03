# Service Overview Dashboard

Turn the empty Overview tab into a read-only service dashboard with key metrics, schedule snapshot, plan snapshot, tasks progress, and notes.

## Design Decisions

- **Balanced metrics dashboard** — quick stats cards, schedule snapshot, plan snapshot, tasks progress, notes
- **Read-only** — no inline actions (Confirm/Decline/Edit remain in their tabs)
- **Tasks progress** — simple progress bar only (no task list)
- **Stat cards** — minimal text + number style

## Layout

```
┌─────────────────────────────────────────┐
│ [Status Badge] · [Countdown: "in 3 days"]│
├─────────────────────────────────────────┤
│  Plan: 8   Songs: 5   Team: 4/6  ~45m  │
├─────────────────────────────────────────┤
│ Schedule Snapshot  (grouped by role)     │
│  Worship Leader    John S.  ● Confirmed │
│  Vocals            Mary K.  ○ Pending   │
├─────────────────────────────────────────┤
│ Plan Snapshot  (compact service order)   │
│  1. Welcome                 5 min        │
│  2. How Great Is God  G     6 min        │
├─────────────────────────────────────────┤
│ Tasks Progress                          │
│  ████████░░░░  8/12 complete            │
├─────────────────────────────────────────┤
│ Notes                                    │
│  Remember to start with...               │
└─────────────────────────────────────────┘
```

## Implementation Tasks

### 1. Add task stats store method (optional, but cleanest)

Add a `getStats` or `getByServiceCount` method to the tasks store that returns total + per-status counts for a service. This avoids coupling the dashboard to the full task list fetch.

### 2. Fetch task stats in ServiceDetailClient

Add a `useEffect` (parallel to `loadData`) that fetches task stats when `serviceId` and `church` are available. Store as `taskStats: { total, done } | null`.

### 3. Replace the Overview tab panel

File: `src/app/(app)/services/[id]/ServiceDetailClient.tsx`  
Location: lines 746–797 (the `<TabPanel p="6">` for Tab 0)

Replace with:

- **Header row**: StatusBadge + countdown string ("in 3 days" / "Today!" / "Past service")
- **Quick stat cards** (horizontal, responsive wrap):
  - "Plan" — total items count
  - "Songs" — `items.filter(i => i.type === 'song').length`
  - "Team" — `X confirmed / Y total` (from `assignments`)
  - "Duration" — sum of `items[].duration_minutes` or "—"
- **Schedule Snapshot** section heading + compact rows:
  - Iterate `assignments`, show role, member name, StatusBadge
  - Group by role if desired — simple list is fine
- **Plan Snapshot** section heading + compact rows:
  - Iterate `items`, show position, icon, title, key badge (if song), duration
  - No drag, no edit menu
- **Tasks Progress** section heading + Progress bar + "X/Y tasks complete"
- **Notes** section heading + notes text (or "No notes" empty state)

### 4. Verify with existing data

- Confirm all data sources are already loaded in `ServiceDetailClient` state
- Assignments and items are loaded in `loadData`

## Files Changed

| File | Change |
|------|--------|
| `src/app/(app)/services/[id]/ServiceDetailClient.tsx` | Replace Overview tab panel (lines 746–797) with dashboard layout |
| (Optional) Tasks store file | Add lightweight count method |

## Validation

- Overview tab renders all dashboard sections without errors
- Stat numbers match Plan and Schedule tab counts
- Countdown text handles past/future dates correctly
- Empty states render gracefully (no items, no assignments, no tasks, no notes)
- Mobile layout wraps stat cards and truncates long names
- Dark mode colors follow existing pattern (`cardBg`, `borderColor`, etc.)
