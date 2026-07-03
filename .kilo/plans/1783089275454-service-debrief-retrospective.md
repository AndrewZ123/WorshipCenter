# Service Debrief / Retrospective ("Post-game")

## Overview

A structured 2-minute post-service flow each team member completes when a service is marked "completed". Captures ratings, reflections, timing comparisons, and rolls up into a cross-service trends view.

## Design Decisions

| Decision | Choice |
|---|---|
| Trigger | When service status changes to "completed" |
| Structure | Individual entries per team member |
| Rating | Multi-axis: engagement, flow, tech (each 1-5) |
| Reflection fields | 4 required: what_went_well, what_broke, what_to_change, saw_god_working |
| Timing capture | `actual_duration_seconds` on `service_items`; debrief auto-populates from it |
| Who is prompted | All assigned team members + the user who marked it completed |
| Service Log view | New dedicated page at `/services/debriefs` |
| Timing storage | Column on `service_items` (queryable for song-level analytics) |

## Implementation Tasks

### 1. Database Migration (`supabase/migrations/036_add_service_debriefs.sql`)

**Add column to `service_items`:**
```sql
ALTER TABLE service_items ADD COLUMN actual_duration_seconds INTEGER;
```

**New table `service_debriefs`:**
```sql
CREATE TABLE service_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  rating_engagement INTEGER NOT NULL CHECK (rating_engagement BETWEEN 1 AND 5),
  rating_flow INTEGER NOT NULL CHECK (rating_flow BETWEEN 1 AND 5),
  rating_tech INTEGER NOT NULL CHECK (rating_tech BETWEEN 1 AND 5),
  what_went_well TEXT NOT NULL DEFAULT '',
  what_broke TEXT NOT NULL DEFAULT '',
  what_to_change TEXT NOT NULL DEFAULT '',
  saw_god_working TEXT NOT NULL DEFAULT '',
  timing_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, user_id)
);
```

**Indexes:**
- `idx_service_debriefs_service ON service_debriefs(service_id)`
- `idx_service_debriefs_church_user ON service_debriefs(church_id, user_id)`
- `idx_service_debriefs_created ON service_debriefs(created_at DESC)`

**RLS policies:** SELECT/INSERT/UPDATE for authenticated users whose church_id matches. DELETE for admin/leader only. Follow existing church-scoped pattern.

**Extend notification type check:**
```sql
ALTER TABLE notifications DROP CONSTRAINT ... ;
ALTER TABLE notifications ADD CONSTRAINT ... CHECK (type IN ('invitation', 'status_change', 'service_reminder', 'general', 'assignment_created', 'assignment_reminder', 'assignment_changed', 'assignment_declined', 'initial_reminder', 'pre_rehearsal_reminder', 'pre_service_reminder', 'escalation', 'debrief_request'));
```
(Use a single ALTER to replace the constraint.)

### 2. Types (`src/lib/types.ts`)

Add:
- `ServiceDebrief` interface mirroring the table columns
- `ServiceDebriefPopulated` extending with `user: ChatUserInfo`
- `TimingComparisonItem: { item_id: string; title: string; type: string; planned_seconds: number | null; actual_seconds: number | null }`
- `DebriefTrends: { avg_engagement: number; avg_flow: number; avg_tech: number; total_debriefs: number; period: string }`

### 3. Store Methods (`src/lib/store.ts`)

Add `db.debriefs`:
- `getByService(serviceId, churchId)` → all entries for a service, populated with user
- `getByChurch(churchId, options?)` → all entries with optional date range filter
- `getByUser(churchId, userId)` → entries by a specific user across services
- `getById(id, churchId)` → single entry
- `upsert(data)` → create or update (enforced by UNIQUE(service_id, user_id))
- `delete(id, churchId)`
- `getTrends(churchId, months?)` → aggregated averages per month

### 4. Service Mode Timing Persistence (`src/components/services/ServiceMode.tsx`)

- When Service Mode closes, save elapsed times to `service_items.actual_duration_seconds` for each item that was advanced through
- Add a "Save & Exit" flow: prompt user to confirm saving timing data before closing
- On item advance (`handleNext`), persist the elapsed time for the item being left
- On final item complete, persist its time as well

### 5. Debrief Form Component (`src/components/services/ServiceDebriefForm.tsx`)

Props: `service`, `items`, `existingEntry?`, `currentUser`, `churchId`, `onSubmit`, `onClose`

Sections:
- **Header**: Service title, date, "Your Debrief"
- **Ratings**: Three star-based 1-5 selectors (engagement, flow, tech) using Chakra RadioGroup or custom star buttons
- **Timing section** (shown only if any item has actual_duration_seconds):
  - Table: Item | Planned | Actual | ±Variance
  - Pre-populated from `service_items`; actual times are editable
  - Variance shown in red (over) or green (under)
- **Reflection fields**: Four textareas with labels/placeholders; marked as "required" with gentle validation
- **Submit**: Upserts the entry, calls `onSubmit`, shows success toast

### 6. Debrief Tab on Service Detail (`src/app/(app)/services/[id]/ServiceDetailClient.tsx`)

- Add "Debrief" tab to the tab list (index 6, after Rehearsal)
- Tab content shows:
  - If current user has submitted: their entry (read-only with "Edit" button)
  - If not submitted: "Submit Your Debrief" button and prompt
  - Leader view: list of all team member entries with status (submitted/pending)
- Debrief form opens as a modal from this tab

### 7. Auto-prompt on Status Change

In the Overview tab's editing section, when user changes status to "completed":
- Immediately open `ServiceDebriefForm` modal for the current user
- Send `debrief_request` notification to all assigned team members with link to the Debrief tab

### 8. Service Log Page (`src/app/(app)/services/debriefs/page.tsx`)

Dedicated analytics page:
- **Header**: "Service Log" with description
- **Timeline view**: Chronological list of all services with debrief entries
- **Trend cards**: Average engagement/flow/tech over time (last month, 3 months, all)
- **Filter bar**: Date range, team member, minimum rating
- **Individual entries**: Expandable cards showing ratings, reflection text, timing details
- **Tone/theme highlights**: Simple keyword frequency analysis of reflection fields

### 9. Notifications Integration

- Add `debrief_request` to notification types
- When service is completed, create notifications for all assigned team members + completer
- Notification title: "Debrief requested — {service title}"
- Notification message: "Please submit your debrief for {service title} on {date}"
- Link URL points to `/services/{serviceId}?tab=debrief`

## Implementation Order

1. Migration + schema (item 1)
2. Types + store methods (items 2-3)
3. ServiceDebriefForm component (item 5)
4. Debrief tab on service detail (item 6)
5. Service Mode timing persistence (item 4)
6. Auto-prompt on completed status (item 7)
7. Service Log page (item 8)
8. Notification integration (item 9)

## Validation

- Run migration against local Supabase
- `npm run lint` — zero errors
- Manual flow test: create service → add items → use Service Mode → mark completed → debrief auto-opens → submit → view on Service Log page
- Verify RLS: non-church user cannot see/access debrief data
- Test notification delivery on completion
- Verify debrief edit works (upsert doesn't create duplicates)
