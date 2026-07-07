# Volunteer Permission System

## Goal

Build a permission system that gives volunteers (`team` role) a focused, read-only experience showing only their relevant data, while keeping all admin features (services management, team management, templates, reports, billing, settings) hidden.

## Design Decisions (Confirmed with User)

| Decision | Choice |
|---|---|
| `leader` role treatment | Not a separate permission tier — treated as volunteer. Display labels live in `team_member.roles[]`. |
| Admin permissions | Granular via `admin_permissions` table (manage_services, manage_songs, etc.) |
| Service Detail for volunteers | Read-only full view — all tabs visible but no edit/create/delete |
| Team member roster | Hidden entirely from volunteers. Names + avatars still visible in chat/schedule inline context. |
| Service list filter | Volunteers only see services they are assigned to |
| Permission architecture | Centralized `usePermissions()` hook replacing scattered `user.role === 'team'` checks |
| Role badge display | Show `team_member.roles[]` display names instead of "Team Member" / "Leader" generic labels |

---

## Phase 1 — Permission Infrastructure

### 1.1 Create `src/lib/permissions.ts`

A centralized permission hook and utility functions.

```typescript
// Permission scopes mirror AdminPermission fields
export type PermissionScope =
  | 'manage_services'
  | 'manage_songs'
  | 'manage_team'
  | 'manage_templates'
  | 'manage_settings'
  | 'manage_billing'
  | 'manage_chat'
  | 'manage_admins';

export interface Permissions {
  isAdmin: boolean;
  isVolunteer: boolean;
  can: (scope: PermissionScope) => boolean;
  loading: boolean;
  roleLabel: string; // display name from team_member.roles[0] or fallback
}
```

The hook:

1. Fetches the user's `admin_permissions` row from the store (or from a cached context) on mount.
2. Defines `isAdmin` as `user.role === 'admin'`.
3. Defines `isVolunteer` as `user.role !== 'admin'` (covers both `team` and `leader`).
4. `can(scope)` returns:
   - `false` if `isVolunteer` (volunteers can never manage anything)
   - `true` if the user is admin and the scope is `true` in their `admin_permissions` row (defaults to `true` if no row exists — admins get full access by default).
5. `roleLabel` reads `team_member.roles[0]` from the user's linked team member record for display, falling back to "Team Member" or "Admin".

**Caching**: Cache the admin_permissions row in a React context (no localStorage needed — it's fetched once and stored in the context).

**Important**: The `admin_permissions` row is church-scoped. A user belongs to one church, so one row per user.

### 1.2 Create `src/lib/PermissionsContext.tsx`

A React context that wraps the app (inside `StoreProvider`) to provide `Permissions` to all components without re-fetching.

- Fetches `admin_permissions` when the user changes
- Uses `useAuth()` to get user/church
- Fetches `admin_permissions` from store: `await db.adminPermissions.getByUser(user.id, church.id)`
- Also fetches `team_member` record to get `roles[]` array for display name

### 1.3 Update `AppShell.tsx` (layout wrapper)

Integrate `PermissionsProvider` into the component tree. It should be placed inside `StoreProvider` but outside `AppShell`.

**In `src/app/(app)/layout.tsx`**: Wrap children with `PermissionsProvider` inside the existing `StoreProvider`.

### 1.4 Remove `leader` special treatment

Replace `user.role === 'leader'` checks with the new permission system:

- `chat/page.tsx:44` — `isAdmin = user?.role === 'admin' || user?.role === 'leader'` → use `permissions.isAdmin`
- `dashboard/page.tsx:58` — `user?.role === 'team'` → use `permissions.isVolunteer`
- All other scattered `user.role === 'team'` checks → `permissions.isVolunteer`

**Note**: `user.role` can remain as-is in the database/type for backward compat. The `leader` value just loses its special treatment in the permission logic.

---

## Phase 2 — Route Protection

### 2.1 Update `src/app/(app)/layout.tsx` restricted prefixes

Current:
```typescript
const restrictedPrefixes = ['/team', '/templates', '/usage'];
```

New:
```typescript
const restrictedPrefixes = ['/team', '/templates', '/usage', '/reports', '/services/debriefs', '/settings/billing'];
```

Also update the protection check to use the permissions system:
```typescript
if (permissions.isVolunteer && restrictedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix))) {
  router.replace('/dashboard');
}
```

### 2.2 Route guard for `/settings/billing`

The billing page is already behind `SubscriptionGate`, but volunteers should not be able to navigate to it at all. The route protection above handles this.

### 2.3 Note on demo routes

The `src/app/demo/` directory has its own pages. These are separate and do not need role-based protection (demo is a preview mode). Leave them unchanged.

---

## Phase 3 — Sidebar & Navigation

### 3.1 Update `src/components/layout/AppShell.tsx`

**Current TEAM_HIDDEN_ITEMS**:
```typescript
const TEAM_HIDDEN_ITEMS = ['/team', '/usage', '/reports'];
```

**New**: Use permissions context to drive nav visibility.

Replace the `TEAM_HIDDEN_ITEMS` approach with a function:

```typescript
const getVisibleNavItems = (permissions: Permissions): NavItem[] => {
  return NAV_ITEMS.filter(item => {
    if (!permissions.isAdmin) {
      // Volunteers see only: Dashboard, Services, My Tasks, Songs, Team Chat
      const allowedHrefs = ['/dashboard', '/services', '/tasks', '/songs', '/chat'];
      return allowedHrefs.includes(item.href);
    }
    return true;
  });
};
```

**Current NAV_ITEMS** (all users):
1. Dashboard
2. Services
3. My Tasks
4. Songs
5. Team
6. Team Chat
7. Song Usage
8. Reports

**Volunteer NAV_ITEMS**:
1. Dashboard
2. Services
3. My Tasks
4. Songs
5. Team Chat

### 3.2 Update BottomNav

Current `src/components/layout/BottomNav.tsx` hardcodes 5 items including "More" which opens the sidebar drawer. No changes needed — the drawer content will already be filtered. But verify that "More" → drawer shows only the volunteer nav items.

### 3.3 Billing menu item

Already gated to `user?.role === 'admin'` (AppShell.tsx:376). Update to use `permissions.can('manage_billing')` for consistency.

---

## Phase 4 — Dashboard

### 4.1 Filter services to only show volunteer's services

In `src/app/(app)/dashboard/page.tsx`:

- For volunteers: only load services where the volunteer has an assignment or task
- For admins: load all services (current behavior)

```typescript
useEffect(() => {
  async function loadData() {
    if (!church || !user) return;
    try {
      setLoading(true);
      let svcs: Service[];
      
      if (permissions.isVolunteer) {
        // Load only services where this user has an assignment or task
        const myAssignments = await store.assignments.getByTeamMember(user.team_member_id!, church.id);
        const myTaskServiceIds = /* tasks grouped by service */;
        const myServiceIds = new Set([...myAssignments.map(a => a.service_id), ...myTaskServiceIds]);
        const allSvc = await store.services.getByChurch(church.id);
        svcs = allSvc.filter(s => myServiceIds.has(s.id));
      } else {
        svcs = await store.services.getByChurch(church.id);
      }
      
      svcs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setServices(svcs);
      // ...
    }
  }
}, [church, user, permissions]);
```

### 4.2 Hide admin-only dashboard sections

Already handled:
- Stats grid: hidden for `team` ✓
- Quick actions: hidden for `team` ✓

Update to use `permissions.isVolunteer` instead of `user?.role === 'team'`:
- Line 58: `if (!church || user?.role === 'team') return;` → `if (!church || permissions.isVolunteer) return;` (for rehearsal stats)
- Line 296: `{user?.role !== 'team' && (` → `{!permissions.isVolunteer && (`
- Line 397: `user?.role === 'team'` → `permissions.isVolunteer`
- Line 399: `user?.role !== 'team'` → `!permissions.isVolunteer`
- Line 416: `{user?.role !== 'team' && (` → `{!permissions.isVolunteer && (`

### 4.3 Volunteer-specific empty state

When a volunteer has no services (not assigned to any), show:
"You haven't been assigned to any services yet."
Instead of current admin text: "No upcoming services" with "Create Service" button.

---

## Phase 5 — Services List Page

### 5.1 Filter services list for volunteers

In `src/app/(app)/services/page.tsx`:

Load only assigned services (same logic as dashboard):

```typescript
const loadData = async () => {
  if (!church) return;
  try {
    setLoading(true);
    let all: Service[];
    
    if (permissions.isVolunteer && user?.team_member_id) {
      const assignments = await store.assignments.getByTeamMember(user.team_member_id, church.id);
      const serviceIds = [...new Set(assignments.map(a => a.service_id))];
      // Also check tasks
      const tasks = await store.tasks.getMyTasks(church.id, user.team_member_id);
      for (const t of tasks) {
        if (t.service_id) serviceIds.push(t.service_id);
      }
      const uniqueIds = [...new Set(serviceIds)];
      const promises = uniqueIds.map(id => store.services.getById(id, church.id));
      all = (await Promise.all(promises)).filter(Boolean);
    } else {
      all = await store.services.getByChurch(church.id);
    }
    
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setServices(all);
  }
};
```

### 5.2 Hide admin actions

Already handled by `isReadOnly` (line 84). Update to `permissions.isVolunteer`.

Ensure the following are hidden for volunteers:
- "New Service" button (top of page)
- "Create Template" button
- Template creation/generation modals
- Delete/Duplicate action buttons on service rows
- The "Templates" section toggle (line 55 `showTemplates` is not meaningful for volunteers)

### 5.3 Show a volunteer-appropriate empty state

If no services loaded for volunteer:
"You haven't been assigned to any services yet. When a leader schedules you, your services will appear here."

---

## Phase 6 — Service Detail Page

### 6.1 Tab visibility

User wants all tabs visible but read-only. The current tabs (from ServiceDetailClient.tsx) are:
1. Overview (service info, items list)
2. Plan (service item ordering)
3. Team (schedule/assignments)

Additional sections:
- Service Chat (accessible from within)
- Tasks
- Debrief
- Service Mode / Live Dashboard

### 6.2 Read-only enforcement

Current: `const isReadOnly = user?.role === 'team';` (line 163)
Update: `const isReadOnly = permissions.isVolunteer;`

All admin UI elements are already gated behind `isReadOnly` or `user.role !== 'team'` checks. Replace all `user.role === 'team'` / `user.role !== 'team'` checks with `permissions.isVolunteer`.

**Specific checks to update in ServiceDetailClient.tsx**:

- Line 163: `isReadOnly` assignment
- Line 451: `.filter(u => u.role !== 'team')` — this filters users in the assign-to dropdown. For volunteers this code path won't be reached because they can't assign, but update for consistency.
- Line 1130: `user && (user.team_member_id || user.role !== 'team')` → `user && (user.team_member_id || !permissions.isVolunteer)`
- Line 1563: same pattern
- Line 1571: `isLeader={user.role !== 'team'}` → `isLeader={!permissions.isVolunteer}`

### 6.3 Volunteer-specific action items on service detail

What a volunteer CAN do on a service detail:
- View the plan (songs/segments in order)
- View the schedule (who's assigned to what)
- View their own assignments (with confirm/decline buttons)
- View tasks (and mark their own as done)
- View and post in service chat
- Submit a debrief after the service (if they participated)

What a volunteer CANNOT do:
- Add/edit/remove service items
- Reorder service items (drag-and-drop)
- Add/edit/remove team assignments (except confirm/decline their own)
- Add/edit/remove tasks (except mark own as done)
- Edit service metadata (title, date, time, status)
- Delete service
- Duplicate service
- Create template from service

### 6.4 Verify debrief submission

Check that volunteers can submit debriefs but not view the aggregate debriefs page at `/services/debriefs`. The debrief form on the service detail page is fine — volunteers should be able to submit their feedback. The aggregation/analytics view (`/services/debriefs`) is admin-only (route-protected in Phase 2).

---

## Phase 7 — Songs Page

### 7.1 Keep read-only, hide admin actions

Current: `const isReadOnly = user?.role === 'team';` (line 77)
Update: `const isReadOnly = permissions.isVolunteer;`

Elements to hide for volunteers:
- "Add Song" button
- Upload/Import ChordPro buttons
- Edit button on each song row
- Delete button on each song row
- The "filter recent" toggle — fine to keep if it's informational

### 7.2 Song detail page

In `src/app/(app)/songs/[id]/SongDetailClient.tsx`:

Current: `const isTeam = user?.role === 'team';` (line 149)
Update: `const isTeam = permissions.isVolunteer;`

Elements to hide:
- Edit button/modal
- Delete button
- Upload file button
- Usage history section (admin analytics — shows which services used this song)

   The usage history is arguably useful for a volunteer (to see when a song was last played), but user specified "nothing admin side like reports, song usage" — so hide the usage table on the song detail page for volunteers.

### 7.3 Song usage on song detail

Hide the "Times Used" and "Last Used" stats + the usage history table. These are analytics.

---

## Phase 8 — Team Page

### 8.1 Already route-protected

No changes needed — `/team` and `/team/[id]` are already in `restrictedPrefixes`.

### 8.2 Inline team member references

In chat, schedule assignments, and other places where team member names/avatars appear inline, keep them visible. The prohibition is on the _list/roster view_, not on individual references.

---

## Phase 9 — Settings Page

### 9.1 Section visibility

Current state:
- Profile Settings: All users ✓
- Church Settings: Admin only ✓
- Admin Management: Admin only ✓
- My Availability: All users with team_member_id ✓
- Walkthrough Tour: All users ✓
- Support: All users ✓
- Danger Zone (Delete Account): All users ✓

Keep all of this. Replace `user.role === 'admin'` / `user.role !== 'admin'` checks with `permissions.isAdmin`.

**Update in settings/page.tsx**:
- Line 201: `user?.role === 'admin'` → `permissions.isAdmin`
- Line 481: `user.role === 'admin'` → `permissions.isAdmin` (and remove `user.role === 'leader'` display case — for volunteers show the role from team_member.roles[])
- Line 487: Display name logic — instead of hardcoded roles, use `permissions.roleLabel`
- Line 505: `user.role === 'admin'` → `permissions.isAdmin`
- Line 556: `user.role === 'admin'` → `permissions.isAdmin`

---

## Phase 10 — Chat Page

### 10.1 Channel creation gate

Current: `const isAdmin = user?.role === 'admin' || user?.role === 'leader';` (line 44)
Update: `const isAdmin = permissions.can('manage_chat');`

### 10.2 Verify volunteer experience

Volunteers can:
- See all channels (public channels)
- Send messages in channels they have access to
- React to messages
- View member names/avatars in message headers

Volunteers cannot:
- Create channels (already gated)
- Delete channels
- Manage channel settings

---

## Phase 11 — Tasks Page

### 11.1 Already volunteer-friendly

The tasks page at `src/app/(app)/tasks/page.tsx` already:
- Loads tasks assigned to the current user's `team_member_id`
- Only shows when `user.team_member_id` exists

No changes needed. Verify the permission check doesn't need updating (it uses `user.team_member_id` not role).

---

## Phase 12 — Templates, Usage, Reports Pages

### 12.1 Route-protected in Phase 2

These pages are already blocked for volunteers at the route level. No further changes needed to the page files themselves, but verify that:
- `/templates/page.tsx` — no changes needed
- `/usage/page.tsx` — no changes needed
- `/reports/page.tsx` — no changes needed

---

## Phase 13 — Billing Page

### 13.1 Route-protected + menu hidden

Route protection added in Phase 2. Menu item already gated to admin only. No page-level changes needed.

---

## Phase 14 — Role Label Display (Bonus)

Current behavior in settings page:
```
{user.role === 'admin' ? 'Worship Leader (Admin)' : user.role === 'leader' ? 'Leader' : 'Team Member'}
```

New behavior:
- Admin users: `permissions.roleLabel` (e.g., "Worship Leader (Admin)" or just the permissions known)
- Volunteer users: Display their first role from `team_member.roles[]` (e.g., "Vocals", "Acoustic Guitar", "Sound Tech") falling back to "Team Member"

This requires the `PermissionsContext` to fetch the linked `team_member` record and expose `roles[0]` as `roleLabel`.

---

## Files Changed Summary

| File | Change Type |
|---|---|
| `src/lib/permissions.ts` | **NEW** — Permission hook + types |
| `src/lib/PermissionsContext.tsx` | **NEW** — React context for permissions |
| `src/app/(app)/layout.tsx` | EDIT — Add PermissionsProvider, update restrictedPrefixes |
| `src/components/layout/AppShell.tsx` | EDIT — Use permissions for nav filtering, billing menu |
| `src/app/(app)/dashboard/page.tsx` | EDIT — Filter services, use permissions |
| `src/app/(app)/services/page.tsx` | EDIT — Filter services, use permissions |
| `src/app/(app)/services/[id]/ServiceDetailClient.tsx` | EDIT — Use permissions, replace role checks |
| `src/app/(app)/songs/page.tsx` | EDIT — Use permissions |
| `src/app/(app)/songs/[id]/SongDetailClient.tsx` | EDIT — Use permissions, hide usage history |
| `src/app/(app)/settings/page.tsx` | EDIT — Use permissions, update role label |
| `src/app/(app)/chat/page.tsx` | EDIT — Use permissions.can('manage_chat') |
| `src/app/(app)/team/page.tsx` | No change (route-protected) |
| `src/app/(app)/team/[id]/TeamMemberDetailClient.tsx` | No change (route-protected) |
| `src/app/(app)/reports/page.tsx` | No change (route-protected) |
| `src/app/(app)/usage/page.tsx` | No change (route-protected) |
| `src/app/(app)/templates/page.tsx` | No change (route-protected) |
| `src/app/(app)/settings/billing/page.tsx` | No change (route-protected) |
| `src/app/(app)/services/debriefs/page.tsx` | No change (route-protected) |
| `src/app/(app)/tasks/page.tsx` | No change |
| `src/components/layout/BottomNav.tsx` | No change (drawer content handles filtering) |
| `src/lib/auth.tsx` | No change |

---

## Implementation Order

1. **Phase 1** — Create `permissions.ts` and `PermissionsContext.tsx`, integrate into layout
2. **Phase 2** — Route protection (layout.tsx restrictedPrefixes)
3. **Phase 3** — Sidebar nav filtering (AppShell.tsx)
4. **Phase 4** — Dashboard filtering
5. **Phase 5** — Services list filtering
6. **Phase 6** — Service detail permission checks
7. **Phase 7** — Songs page
8. **Phase 9** — Settings page
9. **Phase 10** — Chat page
10. **Phase 14** — Role label display

---

## Validation Checklist

Before marking complete, verify:

- [ ] Volunteer cannot navigate to `/team`, `/templates`, `/usage`, `/reports`, `/services/debriefs`, `/settings/billing` (redirects to `/dashboard`)
- [ ] Volunteer sidebar shows only: Dashboard, Services, My Tasks, Songs, Team Chat
- [ ] Volunteer dashboard shows only their assigned services + their personal tasks
- [ ] Volunteer services list shows only their assigned services (no "New Service" button)
- [ ] Volunteer service detail is fully read-only (no add/edit/delete/drag controls)
- [ ] Volunteer can confirm/decline their own assignments
- [ ] Volunteer can submit debrief on a completed service they were assigned to
- [ ] Volunteer song library is read-only (no add/edit/delete/import)
- [ ] Volunteer song detail hides usage history/analytics
- [ ] Volunteer settings shows: Profile, Availability, Tour, Support, Delete Account (NOT Church Settings, Admin Management)
- [ ] Volunteer chat works but cannot create channels
- [ ] Volunteer role badge shows their `team_member.roles[]` name (e.g., "Vocals") instead of "Team Member"
- [ ] Admin can still see/do everything they could before
- [ ] `leader` role is treated as volunteer (not admin) for all permission checks
- [ ] Leader badge shows their team_member role name too
- [ ] No console errors, no broken UI, no flash of unauthorized content
