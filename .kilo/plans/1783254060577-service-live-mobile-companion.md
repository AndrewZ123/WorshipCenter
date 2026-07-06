# Plan: Service Mode Live Sync + Mobile Companion View

## Goal
- **iPad**: Optimize the existing ServiceMode controller (full-screen modal) for tablet.
- **Phone**: Replace the controller modal with a **companion viewer** showing: live timer (synced from controller), current item details/notes, up-next, and integrated service chat.
- **Sync layer**: Use Supabase Realtime broadcast channels for low-latency state sync + a DB row for persistence/recovery.

---

## Decisions (already resolved)
| Decision | Choice |
|---|---|
| Sync mechanism | Realtime broadcast + DB row (ephemeral timer ticks + persistent state) |
| Cleanup | Delete DB row on controller close; 10s heartbeat timeout on viewer |
| iPad vs phone detection | 768px breakpoint (Chakra `md`) |
| Mobile view route | Same "Service Mode" button; opens controller on >=768px, companion on <768px |
| Light mode | Follow system preference |
| Chat in mobile view | Sticky bottom bar + slide-up sheet overlay with unread notification badge |
| Companion availability | All users, including read-only team members |

---

## Implementation Tasks

### 1. Database Migration — `service_live_sessions` table

**File:** `supabase/migrations/040_add_service_live_sessions.sql`

```sql
create table service_live_sessions (
  id          uuid default gen_random_uuid() primary key,
  service_id  uuid not null references services(id) on delete cascade,
  church_id   uuid not null references churches(id) on delete cascade,
  current_item_id  uuid references service_items(id) on delete set null,
  current_index    integer not null default 0,
  elapsed_ms       bigint not null default 0,
  is_paused        boolean not null default true,
  is_live          boolean not null default false,
  controlled_by    uuid references users(id) on delete set null,
  started_at       timestamptz,
  updated_at       timestamptz not null default now()
);

-- Index for quick lookups and cleanup
create index idx_live_sessions_service on service_live_sessions(service_id);
create index idx_live_sessions_church on service_live_sessions(church_id);

-- RLS: only authenticated users in the same church can read/insert/update/delete
alter table service_live_sessions enable row level security;

create policy "users can read sessions in their church"
  on service_live_sessions for select
  using (church_id in (select church_id from users where id = auth.uid()));

create policy "users can insert sessions in their church"
  on service_live_sessions for insert
  with check (church_id in (select church_id from users where id = auth.uid()));

create policy "users can update sessions in their church"
  on service_live_sessions for update
  using (church_id in (select church_id from users where id = auth.uid()));

create policy "users can delete sessions in their church"
  on service_live_sessions for delete
  using (church_id in (select church_id from users where id = auth.uid()));

-- Enable Realtime for this table (for broadcast + postgres_changes fallback)
alter publication supabase_realtime add table service_live_sessions;
```

### 2. Types — `src/lib/types.ts`

Add:

```ts
export interface ServiceLiveSession {
  id: string;
  service_id: string;
  church_id: string;
  current_item_id: string | null;
  current_index: number;
  elapsed_ms: number;
  is_paused: boolean;
  is_live: boolean;
  controlled_by: string | null;
  started_at: string | null;
  updated_at: string;
}
```

### 3. Store methods — `src/lib/store.ts`

Add a `serviceLive` block with:

- `getSession(serviceId, churchId)` — SELECT single row
- `startSession(serviceId, churchId, userId, currentItemId?, currentIndex?)` — UPSERT (INSERT ... ON CONFLICT on service_id can't work easily since there's no unique constraint on service_id; use a two-step: try SELECT then upsert or just INSERT)
  - Actually simpler: always INSERT a new row, and on viewer side get the latest `is_live = true` row for the service
  - Or: use a unique constraint on `service_id` where `is_live = true` (partial index). But that's complex.
  - Simplest: just INSERT a new row each time, set the old ones to `is_live = false`. Viewers always fetch the one with `is_live = true` ordered by `updated_at desc`.
- `updateSession(sessionId, data)` — UPDATE specific session row
- `endSession(sessionId)` — SET is_live = false; DELETE (to clean up)
- Or combine: `setLiveState(serviceId, churchId, state)` — deactivates old and creates new if starting, or updates existing

**Simplest approach**: The controller just calls REST endpoints or uses the Supabase client directly. We don't need full store methods for this — just a couple of helper functions in a new file. But since the pattern is to use store.ts, we can add the methods there.

### 4. Broadcast Sync — `src/lib/service-live-sync.ts`

New file encapsulating broadcast channel logic:

```ts
// getOrCreateLiveChannel(serviceId) → Supabase Realtime channel
// publishState(channel, state) → { type: 'state_update', currentIndex, currentItemId, elapsedMs, isPaused, timestamp }
// publishHeartbeat(channel) → { type: 'heartbeat' }
// publishEndSession(channel) → { type: 'service_ended' }
// subscribeToLiveState(serviceId, onState, onEnd, onDisconnect) → unsubscribe
//
// Interpolation helper for viewer:
//   computeDisplayElapsed(state) → smooth ms value based on last broadcast timestamp
//   useLiveTimer(state) → hook that returns smoothly counting elapsed
```

The channel name: `service-live:{serviceId}`

### 5. Controller modifications — `src/components/services/ServiceMode.tsx`

**Add to ServiceMode:**
1. On mount (isOpen becomes true):
   - Call `setLiveState` to insert/update the DB row
   - Join the broadcast channel and publish initial state
   - Start periodic state publishing (every 1s) with `publishState()`
2. On state change (currentIndex, isPaused, elapsed):
   - Update local state as before
   - The 1s interval picks up changes; also publish immediately on item change
   - Write to DB every 5s (debounced) to avoid overloading
3. On unmount / close:
   - Call `endSession` → broadcast `service_ended`, clean up DB row
4. **iPad layout optimizations:**
   - Reduce sidebar width on mid-screens (`lg` → `350px`, on iPad maybe collapsible or `250px`)
   - Increase touch target sizes for play/pause/nav buttons
   - Make the main content area more spacious on tablets
   - Ensure fullscreen mode works well on iPad Safari
   - Responsive font sizes that scale well on 768-1024px screens
   - Optional: add a "minimal mode" toggle that hides the sidebar for more screen real estate

### 6. Mobile Companion View — `src/components/services/ServiceMobileView.tsx`

New component for phone-sized devices. Full-screen overlay (similar to how ServiceMode is a Modal).

**Layout (top to bottom):**
1. **Header bar**: Service title, date, "LIVE" badge with pulsing dot, elapsed time (large, mono font). Connection status indicator (green = connected, gray = waiting).
2. **Current item card** (large, prominent):
   - Type icon (music for song, text for segment)
   - Item title (large)
   - Key badge (if song)
   - Notes (if any, in a scrollable area)
   - Assigned to / leader info
3. **Up Next** section (compact, below current item)
4. **Service Flow** (scrollable list of items with current highlighted) — collapsible
5. **Sticky bottom bar**:
   - Chat icon button with unread count badge
   - Tap opens half-sheet overlay with ServiceChat component
   - Chat button gets a subtle bounce/glow animation when new message arrives (via Realtime subscription)

**Sync behavior:**
- On mount: fetch latest `is_live = true` session from DB
- Subscribe to broadcast channel `service-live:{serviceId}`
- On `state_update`: update displayed state, interpolate timer locally via requestAnimationFrame
- On `heartbeat` timeout (>10s since last update): show "Controller disconnected" warning
- On `service_ended`: show "Service ended" state, auto-dismiss after 5s or manual close

**Timer display:**
- Uses `computeDisplayElapsed` from sync helper to smoothly count up
- Shows as `MM:SS` in large mono font
- If paused, timer is frozen and shows paused indicator

**Edge cases:**
- No active session: show "No live service is running" with option to close
- Controller disconnects: show warning banner but keep last state visible
- Multi-controller: last writer wins (simple approach for v1)

### 7. ServiceDetailClient modifications — `src/app/(app)/services/[id]/ServiceDetailClient.tsx`

**Changes:**
1. Add `useMediaQuery` or window width check to determine if device is phone (<768px)
2. Modify the "Service Mode" button behavior:
   - If >= 768px: open `setServiceModeOpen(true)` (existing behavior)
   - If < 768px: open a new `setMobileViewOpen(true)` state
3. Add `ServiceMobileView` modal rendering alongside existing `ServiceMode`:
   ```tsx
   {service && church && (
     <ServiceMobileView
       service={service}
       items={items}
       churchId={church.id}
       currentUser={user}
       isOpen={mobileViewOpen}
       onClose={() => setMobileViewOpen(false)}
     />
   )}
   ```
4. Remove the `isReadOnly` guard from the companion view button so team members can open it too (but keep it for the controller mode button on desktop)
   - On mobile: show the button for ALL users
   - On desktop/tablet: keep existing `!isReadOnly` guard for controller mode

---

## Broadcast Protocol

Messages sent on channel `service-live:{serviceId}`:

```ts
// Controller → Viewers
interface StateUpdate {
  type: 'state_update';
  currentIndex: number;
  currentItemId: string;
  elapsedMs: number;
  isPaused: boolean;
  timestamp: number; // Date.now()
  sessionId: string;
}

interface Heartbeat {
  type: 'heartbeat';
  sessionId: string;
  timestamp: number;
}

interface ServiceEnded {
  type: 'service_ended';
  sessionId: string;
}
```

---

## Data Flow Diagram

```
┌────────────────────┐          ┌─────────────────────┐
│  Controller Device │          │  Viewer Devices      │
│  (Desktop / iPad)  │          │  (Phone / Web)       │
│                    │          │                      │
│  ServiceMode.tsx   │          │  ServiceMobileView   │
│         │          │          │         │            │
│         ▼          │          │         ▼            │
│  broadcast channel │◄────────►│  broadcast channel   │
│  service-live:{id} │          │  service-live:{id}   │
│         │          │          │                      │
│         ▼          │          │                      │
│  DB upsert (1s)    │          │  DB read (on mount)  │
│  service_live_     │          │  latest is_live=true │
│  sessions          │          │                      │
│         │          │          │                      │
│         ▼          │          │                      │
│  DELETE on close   │          │  show ended state    │
└────────────────────┘          └─────────────────────┘
```

---

## Validation Plan

1. **Unit / integration checks:**
   - Confirm migration runs cleanly and RLS policies work
   - Confirm broadcast messages send and receive on the same client (test channel)
2. **Manual test scenarios:**
   - Open ServiceMode on desktop → verify DB row created → open companion on phone → verify state syncs
   - Advance items on controller → verify phone updates within ~500ms
   - Pause timer → verify phone timer freezes
   - Close ServiceMode → verify phone shows "ended" after ≤10s
   - Kill browser tab (controller crash) → verify phone detects heartbeat loss after 10s
   - Send chat message from phone → verify it appears in ServiceChat for everyone
   - Verify companion view opens for team members on phone
   - Verify controller does NOT open for team members on desktop
3. **iPad-specific checks:**
   - ServiceMode renders well at 768-1024px widths
   - Touch targets are ≥44px
   - Fullscreen mode works in iPad Safari
4. **Edge cases:**
   - No active session: companion shows idle state
   - Two controllers: last broadcast wins (no lock needed for v1)
   - Service with no items: button is disabled (existing behavior)

---

## Open Questions (out of scope for v1)

- Presence-based multi-controller arbitration
- Historical timing data from live sessions (beyond what's already captured)
- Push notifications when service goes live
- "Join live service" deep link from team notifications
