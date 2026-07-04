# Demo Site Mirror Plan

## Goal
Make the demo site (`app/demo/`) mirror the real platform's features with sample data that resets on refresh. The demo already resets via `getInitialDemoData()` — the focus is feature parity.

## Approach
Enhance demo-specific page implementations (not reuse real components) since real components are tightly coupled to Supabase (`@/lib/auth`, `db` from `@/lib/store`). Use `useDemo()` hook for all data access.

---

## Phase 1: Enhance Demo Data Layer

### 1A. Add missing CRUD operations to `DemoContext` (`src/lib/demo/context.tsx`)

Add state + CRUD for:
- **tasks**: `createTask`, `updateTask`, `deleteTask`, `toggleTask`, `reorderTasks`
- **memberGroups**: `createGroup`, `updateGroup`, `deleteGroup`, `addGroupMember`, `removeGroupMember`
- **memberNotes**: `createMemberNote`, `deleteMemberNote`
- **chatChannels**: state already in data, no CRUD needed
- **debriefs**: `upsertDebrief`, `deleteDebrief`, `getDebriefByService`
- **rehearsals**: `markRehearsed`, `markAllRehearsed`, `getRehearsalStats`

Also add these new state arrays to context type and provider.

### 1B. Fill in `createDemoStore` stubs (`src/lib/demo/store.ts`)

Replace empty stubs with real calls to `getDemoContext()` for:
- `tasks.*` — all methods
- `memberGroups.*` — all methods
- `memberNotes.*` — all methods  
- `channels.*` — all methods
- `taskTemplates.*` — all methods
- `debriefs.*` — all methods
- `rehearsals.*` — already partially implemented, verify coverage

### 1C. Add more demo data (`src/lib/demo/data.ts`)

- Add demo chat channels to `getInitialDemoData()` return (data already exists as `DEMO_CHAT_CHANNELS`)
- Add demo debrief entries for completed services
- Add demo task template items
- Ensure `rehearsalLogs` return is included (already there)
- Ensure `tasks`, `memberGroups`, `memberGroupMembers`, `memberNotes`, `chatChannels` are all included in return

---

## Phase 2: Create Missing Demo Pages

### 2A. `app/demo/tasks/page.tsx` — My Tasks

Mirror `app/(app)/tasks/page.tsx`:
- Two tabs: "To Do" / "Completed"
- Search/filter input
- Task cards with checkbox toggle, service context, role badge
- Click task → navigate to `/demo/services/[service_id]`
- Uses `useDemo()` for data (tasks, services, teamMembers)

### 2B. `app/demo/settings/page.tsx` — Settings

Mirror `app/(app)/settings/page.tsx` (without Supabase-dependent features):
- Profile section: name, email (read-only), avatar (without upload)
- Church section: name, slug (read-only), description
- Walkthrough Tour section  
- Danger Zone: Reset Demo instead of Delete Account
- Uses `useDemo()` for user/church data

### 2C. `app/demo/services/debriefs/page.tsx` — Debriefs/Service Log

Mirror `app/(app)/services/debriefs/page.tsx`:
- Date range filter
- Trends overview (avg ratings)
- List of debrief entries with expandable details
- Uses `useDemo()` for services, demo debriefs data

### 2D. `app/demo/templates/[id]/page.tsx` — Template Editor

Mirror `app/(app)/templates/[id]/`:
- Template name, day, time editing
- Add/edit/reorder items (songs + segments)
- Required roles configuration
- Generate service button
- Uses `useDemo()` for templates data

---

## Phase 3: Enhance Existing Demo Pages

### 3A. Overhaul `app/demo/services/[id]/ClientPage.tsx`

Add tab-based architecture matching the real `ServiceDetailClient.tsx`:
- **Plan tab** (existing items + assignments, enhanced)
- **Tasks tab** — Shows tasks for this service from demo data with toggle
- **Rehearsal tab** — Per-member rehearsal tracking for songs in this service
- **Service Chat tab** — Messages for this specific service
- **Debrief tab** — Submit/view debrief for this service
- Keep items/schedule/assignments in the Plan tab
- Use `useDemo()` for all data

### 3B. Enhance `app/demo/page.tsx` (Dashboard)

- Add My Tasks section showing the user's pending tasks
- Add rehearsal progress section on service cards (for finalized/upcoming services)
- Add quick stats in a cleaner layout
- Keep existing sections (upcoming, recent, quick actions)

### 3C. Update `app/demo/layout.tsx` Navigation

Add missing nav items:
- `app/demo/tasks` — My Tasks (icon: CheckSquare)
- `app/demo/settings` — Settings (icon: Settings)
- `app/demo/chat` — Chat (already exists but not in nav)

---

## Phase 4: Navigation & Styling

### 4A. Update demo sidebar to include all sections

Full nav items list:
1. Dashboard (`/demo`)
2. Services (`/demo/services`) 
3. Songs (`/demo/songs`)
4. Team (`/demo/team`)
5. Tasks (`/demo/tasks`) ← NEW
6. Templates (`/demo/templates`)
7. Song Usage (`/demo/usage`)
8. Reports (`/demo/reports`)
9. Team Chat (`/demo/chat`) ← was missing from nav
10. Settings (`/demo/settings`) ← NEW
11. Billing (`/demo/settings/billing`)

### 4B. Add BottomNav for mobile

The real app uses `BottomNav` component on mobile (`lg` breakpoint and below). The demo currently only has a hamburger drawer. Add `BottomNav` to `DemoShell` so mobile users get the same bottom tab bar with Home, Services, Tasks, Chat, More.

### 4C. Match theme and styling

- Both apps share the same `ChakraProviderWrapper` at the root level, so the theme is already identical
- Ensure all new demo pages use the same `useColorModeValue`, `borderColor`, `cardBg`, `hoverBg`, `textColor`, `subtextColor` patterns as the real pages
- Match responsive breakpoints: same `display={{ base: ..., md: ..., lg: ... }}` patterns
- Match safe-area-inset patterns (already in globals.css, shared)
- Match mobile header height and spacing

### 4D. Add back button from settings to navigate demo layout properly

Ensure all new pages have proper back navigation.

---

## Implementation Order

1. Phase 1A + 1C: Context + data enhancements (foundation)
2. Phase 1B: Store stubs (needed by some pages)
3. Phase 2A: Tasks page (high impact, standalone)
4. Phase 2B: Settings page (high impact)
5. Phase 3C + 4A: Nav updates (quick wins)
6. Phase 3B: Dashboard enhancements
7. Phase 3A: Service detail overhaul (largest effort)
8. Phase 2C: Debriefs page
9. Phase 2D: Template editor page

---

## Validation

1. Visit `/demo` → Dashboard shows tasks, rehearsal stats, quick actions
2. Visit `/demo/tasks` → Shows demo tasks with toggle functionality
3. Visit `/demo/settings` → Profile and church info displayed
4. Visit `/demo/services/[id]` → Tab-based detail with Plan, Tasks, Rehearsal, Chat, Debrief
5. Visit `/demo/services/debriefs` → Demo debrief entries shown
6. Click "Reset Demo" in banner → All data restored, URL navigation stays
7. Refresh page → Same initial state as first load
