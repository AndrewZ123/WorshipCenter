# WorshipCenter — Ideas, Bugs, & Detailed Roadmap

> Comprehensive document organizing all product ideas, feature requests, known bugs, and planned enhancements.
> Last updated: 2026-07-07 (Section 1 implemented)

---

## Table of Contents

1. [Volunteer Self-Signup for Open Positions](#1-volunteer-self-signup-for-open-positions)
2. [Offline Access to Plans, Charts, & Service Details](#2-offline-access-to-plans-charts--service-details)
3. [Better Scheduling Intelligence](#3-better-scheduling-intelligence)
4. [PDF & File Upload UX Overhaul](#4-pdf--file-upload-ux-overhaul)
5. [ChordPro Handling Enhancements](#5-chordpro-handling-enhancements)
6. [Multiple Arrangements per Song with File Inheritance](#6-multiple-arrangements-per-song-with-file-inheritance)
7. ["Download All for This Service" Bundles](#7-download-all-for-this-service-bundles)
8. [Mobile-First File Access](#8-mobile-first-file-access)
9. [Known Bugs & Fixes](#9-known-bugs--fixes)
10. [Volunteer Onboarding Journey](#10-volunteer-onboarding-journey)
11. [About / How-To Section](#11-about--how-to-section)
12. [Plan-Change Notifications Enhancements](#12-plan-change-notifications-enhancements)
13. [CCLI SongSelect API Integration](#13-ccli-songselect-api-integration)
14. [Service Debrief / Retrospective Enhancements](#14-service-debrief--retrospective-enhancements)
15. [Multi-Admin Enhancements](#15-multi-admin-enhancements)
16. [Dashboard Navigation Improvements](#16-dashboard-navigation-improvements)
17. [Auto-Scheduling / "Suggest a Volunteer"](#17-auto-scheduling--suggest-a-volunteer)
18. [Training Hub & Volunteer Pathways](#18-training-hub--volunteer-pathways)
19. [Support / Help Center Overhaul](#19-support--help-center-overhaul)
20. [Global App-Wide Enhancements](#20-global-app-wide-enhancements)

---

## 1. Volunteer Self-Signup for Open Positions

**Status: ✅ Implemented**

### Current State
All team member signup is admin-initiated. Admins add members manually or send email invitations. There is no mechanism for a volunteer to browse open positions and sign themselves up — something Planning Center Services lets teams enable via "signup sheets."

### Proposed Implementation

#### 1.1 Open Positions Dashboard
- New "Serve" / "Sign Up" page accessible from the login screen and app nav for volunteers
- Lists all services with open positions (roles that are unfilled for upcoming services)
- Each row shows: service date/time, role name, how many slots are open, and a "Sign Up" button
- Volunteers can filter by role (Vocals, Guitar, Drums, Sound, etc.) and date range

#### 1.2 Signup Flow
1. Volunteer clicks "Sign Up" on a position
2. If already a team member: confirm assignment (with optional note)
3. If not a team member: lightweight registration form (name, email, phone, preferred roles) -> auto-creates team member record -> auto-confirms assignment
4. Admin receives notification: "[Name] signed up for [Role] on [Service Date]"
5. Admin can approve, reassign, or remove the signup

#### 1.3 Admin Controls
- Service-level toggle: "Allow signups" (on/off) for each service position
- Per-role signup limits (set max 3 vocalists, 1 drummer, etc.)
- Auto-approve vs. require admin approval toggle per church
- "Open Positions" admin view showing all signup requests and their status

#### 1.4 Data Model Additions
```sql
-- Track signup-enabled roles per service
ALTER TABLE service_assignments ADD COLUMN signup_enabled boolean DEFAULT false;
ALTER TABLE service_assignments ADD COLUMN signup_max integer; -- max volunteers for this role

-- Track signup requests
CREATE TABLE signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  role text NOT NULL,
  team_member_id uuid REFERENCES team_members(id),
  status text DEFAULT 'pending',  -- 'pending' | 'approved' | 'declined'
  created_at timestamptz DEFAULT now(),
  church_id uuid REFERENCES churches(id) ON DELETE CASCADE
);
```

#### 1.5 Notification Integration
- Reuse existing `notifications.ts` pipeline
- Admin gets `signup_request` notification when someone signs up
- Volunteer gets `signup_confirmed` or `signup_declined` notification

---

## 2. Offline Access to Plans, Charts, & Service Details

**Status: ✅ Implemented**

### Summary
Implemented a complete offline access layer using IndexedDB (`idb` library) for caching Supabase data and queuing mutations:

- **`src/lib/offline/cache.ts`** — IndexedDB cache with TTL-based expiration, per-entity stores (services, songs, serviceItems, assignments, teamMembers, etc.), and bulk cache methods. Automatically clears expired entries.
- **`src/lib/offline/sync.ts`** — Mutation queue for offline creates/updates/deletes. Processes queue sequentially on reconnect with retry logic (max 5 retries per item).
- **`src/lib/offline/OfflineContext.tsx`** — React context monitoring `navigator.onLine`, online/offline events, Capacitor `mobile-resume` events, and triggers auto-sync when connectivity returns.
- **`src/lib/offline/store-overlay.ts`** — `cachedStore` object wrapping the most critical store methods (services, songs, serviceItems, assignments, teamMembers) with network-first/cache-fallback strategy.
- **`src/components/layout/OfflineIndicator.tsx`** — Collapsible banner showing offline status, cached item count, pending sync count, and sync-in-progress spinner.
- **`src/app/_offline/page.tsx`** — Offline fallback page with "Try Again" button and auto-refresh on reconnection.
- **`next.config.ts`** — Added Workbox runtime caching rules for Supabase REST API (NetworkFirst) and Storage (CacheFirst) with background sync.
- **`src/lib/mobile.ts`** — Modified native cache clearing to preserve offline data stores.

No changes needed to existing store methods — the cached store overlay pattern wraps calls transparently.

### Current State
The PWA offline fallback page (`/_offline`) now exists and works. Users viewing previously loaded services, songs, and team data can access them offline. Pending mutations are queued and synced when connectivity returns. An offline indicator banner shows connection status. TypeScript compiles cleanly with no errors.

### Proposed Architecture

#### 2.1 Service Worker Caching Strategy
- **Cache-First for static assets:** App shell, fonts, icons (already handled by PWA)
- **Network-First with cache fallback for API data:** Service plans, song charts, team info
- **Background sync for mutations:** Task completions, assignment confirmations, chat messages

#### 2.2 What to Cache
- **Service plans** — items, order, keys, durations (store as JSON in IndexedDB via `idb` library)
- **Song charts** — cached PDFs and ChordPro files from Supabase Storage
- **Assignments** — what the user is scheduled for
- **Team member info** — names, roles, contact info
- **Recent chat messages** — last N messages per channel

#### 2.3 Data Sync Strategy
- Use a `sync_status` table to track what has been synced
- On app launch (or network come-back): sync pending mutations
- Conflict resolution: last-write-wins with server timestamps
- Offline indicator bar at top of screen when disconnected

#### 2.4 Implementation Plan
1. Install `idb` (IndexedDB wrapper) or use `localforage`
2. Create `src/lib/offline/sync.ts` — sync manager that queues mutations
3. Create `src/lib/offline/cache.ts` — cache reads/writes to IndexedDB
4. Extend store layer (`src/lib/store.ts`) with offline-aware wrappers
5. Create `src/components/layout/OfflineIndicator.tsx` — connection status banner
6. Register background sync in service worker (`sw.ts`)

#### 2.5 Priority Cached Items
```
Priority 1 (always cache):
  - Current user's upcoming services (next 4 weeks)
  - Songs assigned to those services (chord charts + PDFs)
  
Priority 2 (cache on view):
  - Service details when user opens them
  - Chat history (last 100 messages per channel)
  
Priority 3 (nice to have):
  - Full song library
  - Team directory
  - Past services
```

---

## 3. Better Scheduling Intelligence

**Status: ✅ Implemented — conflict detection, unavailable member handling, role-based fill suggestions, and role distribution overview**

### Current State
- `ServiceSchedule.tsx` handles assignment CRUD with confirm/decline workflow
- Email/SMS reminders via `reminders.ts` with configurable timing
- Volunteer preferences and blockout dates are used in the scheduling UI
- Conflict detection when assigning a member to multiple services at the same date
- Role-based fill suggestions with ranked candidates
- Unavailable member filtering in bulk add panel
- Role distribution overview in the service detail page

### Implementation (2026-07-07)

The following features have been implemented across multiple files:

#### 3.1 Conflict Warnings
- **`src/components/services/ServiceSchedule.tsx`**: When the bulk add panel opens, automatically computes conflicts for all unassigned team members on the same service date
- Checks for **double-booking** (member already assigned to another service on the same date) and **blockout dates**
- Shows inline warnings in the member list: blocked-out members get an orange "Blocked" badge, double-booked members get a yellow "Conflict" badge
- Conflicted members are grayed out with `opacity: 0.5` and strike-through styling, checkboxes disabled
- "Assign Anyway" confirmation dialog when trying to assign conflicted members
- **`src/lib/store.ts`**: `assignments.getByDate()`, `assignments.getConflicts()` methods added

#### 3.2 Unavailable Member Handling
- **`src/components/services/ServiceSchedule.tsx`**: "Show unavailable" toggle switch in the bulk add panel header
- When toggled off, conflicted members are hidden from the list
- Info text shows count of hidden members: "Hiding X unavailable member(s)"
- Blocked-out and double-booked members each have distinct colored badges with tooltip explanations
- Same visual treatment in the existing assignment list: blocked-out assignments show `opacity: 0.5` with a "Blocked" badge

#### 3.3 Role-Based Fill Suggestions
- **`src/components/services/SchedulingSuggestions.tsx`** (new): Popover component that provides ranked candidate suggestions for a given role
- Appears as a "Suggest" button next to the role input in the bulk add panel
- Rank algorithm:
  - Base score: 100
  - -10 for each confirmed service in last 90 days
  - -50 for same-day double booking
  - -100 if blocked out on the service date
  - +20 if member has the role in their roles array
- Shows top 5 ranked candidates with score badge, reason tags, and "Assign" button
- Blocked-out candidates shown with alert icon and non-interactive styling
- **`src/lib/types.ts`**: `SchedulingConflict`, `SuggestedAssignment` types added

#### 3.4 Scheduling Dashboard Enhancements
- **`src/app/(app)/services/[id]/ServiceDetailClient.tsx`**: Added "Role Distribution" card in the overview tab showing each role with confirmed/total counts
- **`src/components/services/ServiceSchedule.tsx`**: Added role summary badges above the assignment list showing count per role

---

## 4. PDF & File Upload UX Overhaul

**Status: ✅ Exists — song file uploads with drag-drop, accepts PDF/ChordPro/text**

### Current State
- Song file upload exists in `SongDetailClient.tsx` with drag-drop and file input
- Accepts `.pdf`, `.cho`, `.chordpro`, `.chopro`, `.txt`
- Files are stored in Supabase Storage
- Validation hardening flagged as audit concern

### Proposed Enhancements

#### 4.1 Drag-and-Drop Everywhere
- Drop zone on song detail page (already exists — enhance with visual preview)
- Drop zone on service plan page: drag a PDF directly onto a service item to attach it
- Drop zone on arrangement cards
- Multi-file upload: select/drag multiple files at once

#### 4.2 Mobile Upload UX
- Bottom sheet upload picker on mobile
- Camera capture: "Take Photo of Chart" option using Capacitor Camera plugin
- File picker optimized for mobile (use Capacitor File Picker instead of HTML input)
- Upload progress indicator (currently none)

#### 4.3 Arrangement-Level Attachment
- Currently files can be uploaded at the song level
- Add ability to attach files to a specific arrangement (e.g., acoustic chart attached to the "Acoustic" arrangement)
- Display arrangement-specific files in the arrangement view

#### 4.4 Key-Specific Attachment
- Allow attaching transposed versions of a chart to specific keys
- When a user views a song in a specific key, show the matching chart first
- Auto-transpose ChordPro files on upload and generate key-specific versions

#### 4.5 File Management Improvements
- File preview: inline PDF viewer (using `@react-pdf-viewer` or similar)
- Thumbnail generation for uploaded PDFs/images
- File versioning: keep history of uploaded files per song
- "Replace File" option that keeps the same attachment point
- File size limits displayed in UI before upload

#### 4.6 Service-Level File Attachments
- Attach files to the service itself (not just songs): service running order PDF, pastor's notes, etc.
- "Service Files" section in the service detail page

---

## 5. ChordPro Handling Enhancements

**Status: ✅ Exists — full parser in `src/lib/chordpro.ts`, import modal, renderer**

### Current State
- `chordpro.ts` provides `parseChordPro(text)` and `serializeChordPro(ast)` functions
- Import modal accepts ChordPro text and renders it
- SongSelect export format is supported

### Proposed Enhancements

#### 5.1 Import Improvements
- Drag-and-drop `.cho` / `.chordpro` / `.pro` files directly onto song page
- Import from URL (paste a CCLI SongSelect link or raw ChordPro URL)
- Batch import: upload multiple ChordPro files and match/auto-create songs
- Smart import that extracts metadata (title, artist, key, CCLI number) from ChordPro headers

#### 5.2 In-App ChordPro Editor
- WYSIWYG ChordPro editor with live preview
- Side-by-side edit/preview mode (mobile: toggle switch)
- Syntax highlighting for directives `{title:}`, `{key:}`, `{ccli:}`, etc.
- Chord insertion palette: click to add chord above a word
- Section markers: insert `{start_of_verse}`, `{start_of_chorus}`, etc.
- Undo/redo history

#### 5.3 Transpose
- "Transpose Up/Down" buttons (+1, -1, +5, -5 semitones)
- Shows current key and target key
- Transposes all chords in the ChordPro AST and renders
- Save transposed version as a new arrangement or key-specific file
- Does NOT change the original unless explicitly saved

#### 5.4 Nashville Numbers / Numerals
- Toggle between chord names (C, Am, G7) and Nashville Number System (1, 2m, 5)
- Toggle between Nashville and Roman numerals (I, ii, V)
- Rendering: show both chord AND number in smaller text above
- Configurable per-church: some teams prefer Nashville

#### 5.5 Downloadable Charts
- "Export as PDF" button (client-side using `html2canvas` + `jspdf` or `@react-pdf/renderer`)
- Export as plain text ChordPro (.cho file)
- Export as formatted text (chords aligned above lyrics)
- Print-friendly view with chord diagrams

#### 5.6 SongSelect Import Enhancement
- Currently manual copy-paste from SongSelect
- Add CCLI SongSelect API import (see [CCLI Integration](#13-ccli-songselect-api-integration))
- Auto-fill CCLI metadata from imported ChordPro

---

## 6. Multiple Arrangements per Song with File Inheritance

**Status: ✅ Exists — `SongArrangement` type, store methods, UI in `SongDetailClient.tsx`**

### Current State
- `SongArrangement` type exists with: id, song_id, name, key, tempo, time_signature, structure, notes, is_default
- Store methods: create, update, delete, getBySong, setDefault
- UI in SongDetailClient: arrangement tabs, add/edit arrangement
- https://github.com/Kilo-Org/kilocode/issues

### Proposed Enhancements

#### 6.1 File Inheritance Model
```
Song
 ├── Shared Files (visible in ALL arrangements)
 ├── Arrangement: "Full Band" (key: G)
 │    ├── Inherited: shared song files
 │    ├── Own files: band-specific chart, ProPresenter file
 │    └── Key-specific override: G-transposed chord chart
 ├── Arrangement: "Acoustic" (key: C)
 │    ├── Inherited: shared song files
 │    └── Own files: acoustic-specific chord chart
 └── Arrangement: "Youth" (key: D)
      ├── Inherited: shared song files
      └── Own files: simplified chord chart
```

#### 6.2 Arrangement-Level Key Override
- Each arrangement can set its own default key (different from song default)
- When assigned to a service item, the item can further override the key
- Transpose suggestions when key differs between arrangement and service item

#### 6.3 Bulk Operations
- Duplicate arrangement (copy structure and files)
- "Set as Default" arrangement (used when adding song to a service)
- Batch transpose: change all chords in an arrangement by N semitones

#### 6.4 Arrangement Sharing Between Songs
- "Copy arrangement from..." when creating a new arrangement
- Useful when two songs share similar structures

---

## 7. "Download All for This Service" Bundles

**Status: ❌ Not Implemented**

### Current State
No feature to download all files related to a service as a bundle. Members must open each song individually to access charts.

### Proposed Implementation

#### 7.1 Bundle Generation
- "Download All" button on the service detail page
- Generates a ZIP file containing:
  - All ChordPro files for songs in the service (transposed to the service item key)
  - All PDF attachments for service songs
  - A PDF of the service running order (plan/order of service)
  - A PDF of the schedule (who's assigned to what)
- ZIP is generated server-side (Vercel Serverless function or Edge function with `archiver` or JSZip)
- Or client-side generation using JSZip (no server overhead)

#### 7.2 Bundle Delivery
- Direct download in browser
- Push notification + email with download link when bundle is ready
- Store generated bundle in Supabase Storage (with TTL, auto-cleanup after 7 days)
- "Regenerate Bundle" button if plan changes

#### 7.3 Smart Bundle Options
- "Keyed Charts" option: transposes all ChordPro files to the key listed in the service item
- "Arrangement Specific" option: only include files for the user's assigned arrangement
- "Role Specific" option: only include files relevant to the member's role
- "Compress Audio" option: if audio files are attached, include compressed versions

#### 7.4 Data Flow
```
User clicks "Download All"
  -> Check if cached bundle exists and is fresh
  -> If not: gather all song files + generate PDFs
  -> Transpose ChordPro files to service-item keys
  -> Bundle into ZIP
  -> Upload to Storage (or stream directly)
  -> Return download URL or trigger browser download
```

---

## 8. Mobile-First File Access

**Status: ❌ Not Implemented**

### Current State
No dedicated mobile-optimized file access/viewing experience. Files are accessible through the song detail page, but the mobile experience is basic.

### Proposed Implementation

#### 8.1 "My Files" Tab
- New bottom-nav entry or section within a service: "My Charts" / "My Files"
- Shows only the files relevant to the logged-in user's current/upcoming services
- Grouped by service date, then by song
- Shows file type icons (PDF, ChordPro, audio)

#### 8.2 Mobile File Viewer
- Dedicated full-screen viewer for PDFs (not browser's built-in viewer)
- Swipeable: swipe left/right to move between files in the same service
- Auto-scroll to chord section markers
- "Mark as rehearsed" button on each file (integrates with rehearsal tracking)
- Transpose button in the file viewer (for ChordPro)

#### 8.3 Offline-First Access
- Cache most recently viewed files locally (IndexedDB or Cache API)
- "Download for Offline" toggle on each file
- Offline indicator shows which files are available offline
- "Download All for This Service" for offline use (see section 7)

#### 8.4 File Sharing from Mobile
- Share button: opens native share sheet (Capacitor Share plugin)
- Share as PDF, as ChordPro text, or as a link
- AirDrop / Nearby Share support via native bridge

---

## 9. Known Bugs & Fixes

### 9.1 🔴 Notifications for App Chat Don't Send

**Status: ⚠️ Bug**

**Location:** `src/lib/notifications.ts`, `src/lib/push.ts`, and chat channel notification pipeline

**Description:** Chat notifications (in-app, email, push) are not delivering when a new message is sent in a channel.

**Root Cause Analysis Needed:**
- Check `src/lib/notifications.ts` to verify chat message events trigger notification creation
- Verify Supabase Realtime subscription is correctly listening for `chat_channel_messages` inserts
- Check push notification token registration (`device_tokens` table, migration 038)
- Verify Resend API key is configured and functional for email channel
- Check rate limiting in `src/lib/rateLimit.ts` — may be blocking notification API calls
- Verify the `notifications` table `channels_sent` field is correctly tracking delivery attempts

**Fix Plan:**
1. Add verbose logging to notification dispatch pipeline
2. Verify each channel (in_app, email, push, sms) works independently
3. Check Realtime subscription in chat components subscribes correctly
4. Test push notification with Capacitor Push plugin on physical device
5. Add retry logic for failed notification sends

### 9.2 🟡 Modify Walkthrough Tour for Volunteers

**Status: ✅ Tour exists but not role-customized**

**Location:** `src/lib/tour/`, `src/components/onboarding/TourOverlay.tsx`, `TourContext.tsx`

**Description:** The walkthrough tour shows all steps to every user regardless of role. Volunteers see admin-oriented features they can't use (e.g., creating services, managing songs, reports).

**Fix Plan:**
1. Extend `TourContext` to accept a `role` parameter (`admin | leader | volunteer`)
2. Create separate step definitions:
   - `volunteerSteps`: My Tasks, Service Schedule (view-only), Service Chat, Team Directory, My Profile
   - `adminSteps`: Dashboard stats, Services (create/edit), Songs (manage), Team, Settings
   - `leaderSteps`: subset of admin (services, tasks, team, songs)
3. Filter steps at tour start based on user role
4. Trigger volunteer tour on first signup (see section 10 — Profile Setup Walkthrough)
5. Store `tour_completed_version` on user/church to avoid re-showing

**Current Steps (`src/lib/tour/types.ts`):**
- Read existing tour steps and map which ones apply to which roles

### 9.3 🔴 Create a Channel Modal is Not Styled Properly on Mobile

**Status: ⚠️ Bug**

**Location:** `src/components/chat/ChannelCreateModal.tsx`

**Description:** The channel creation modal uses `size="full"` on mobile (`useBreakpointValue({ base: 'full', md: 'md' })`), which makes it too long vertically and interferes with the device notch, status bar, and bottom controls.

**Fix Plan:**
1. Change mobile size from `full` to `md`
2. Use `isCentered` prop (already set)
3. Add proper safe area insets: `pt="env(safe-area-inset-top)"` and `pb="env(safe-area-inset-bottom)"`
4. Set `maxH="90dvh"` on the modal content
5. Add scrollable body with `overflowY="auto"`
6. Match the styling pattern of the poll creation modal (`PollModal.tsx`) which works well on mobile

**Reference:** Poll modal at `src/components/chat/PollModal.tsx` — replicate its mobile styling

### 9.4 🟡 Completed Tasks Don't Show Under "Completed" Tab

**Status: ⚠️ Bug**

**Location:** `src/app/(app)/tasks/page.tsx`

**Description:** When a task is marked as done, it either disappears or doesn't appear under the "Completed" tab. The My Tasks view may not be refreshing after a task is toggled.

**Root Cause Analysis:**
- In `tasks/page.tsx`, `handleToggleComplete` calls `loadTasks()` after updating
- The filtering `myCompleted = filtered.filter((t) => t.status === 'done')` should catch completed tasks
- Possible issue: `store.tasks.toggleDone()` may not properly update the `status` field in the returned data
- Possible issue: `getMyTasks` in store might filter out completed tasks or only return non-completed ones

**Fix Plan:**
1. Verify `store.tasks.toggleDone()` sets `status = 'done'` and returns the full task object
2. Verify `store.tasks.getMyTasks()` includes tasks with status `done`
3. Check if the store query has a filter like `.neq('status', 'done')` that excludes completed tasks
4. Also verify the "To Do" tab doesn't show completed tasks

### 9.5 🟡 Clicking a Task in Tasks Tab Doesn't Go to Service Item

**Status: ⚠️ Bug / Missing Feature**

**Location:** `src/app/(app)/services/[id]/ServiceDetailClient.tsx`, `src/app/(app)/tasks/page.tsx`

**Description:** Clicking a task in the My Tasks page navigates to the service detail page, but always lands on the Overview tab instead of scrolling to the relevant service item or the Tasks tab within the service.

**Fix Plan:**
1. Store the `activeTab` or `initialTab` when navigating from tasks
2. Pass a query parameter like `?tab=tasks&itemId=<taskId>` when navigating to the service
3. In `ServiceDetailClient`, read these params and:
   - Switch to the Tasks tab (`activeTab=3`)
   - Scroll to or highlight the specific task card
4. OR: navigate to the Plan tab (`activeTab=1`) and scroll to the service item the task is associated with
5. Also apply this pattern from `tasks/page.tsx` dashboard task cards and service task cards

### 9.6 🔴 Groups Don't Save — Created Groups Disappear

**Status: ⚠️ Bug**

**Location:** `src/app/(app)/team/page.tsx`, `src/lib/store.ts` (`memberGroups` namespace)

**Description:** Creating a new group succeeds in the UI, but after refresh or navigation, the group is gone. The group may not be persisting to the database.

**Root Cause Analysis:**
- Check `store.memberGroups.create()` in `src/lib/store.ts:1832-1839`
- Verify the `member_groups` table exists (migration 022) and has correct schema
- Check RLS policies on `member_groups` table — might be blocking the insert
- Check if `church_id` is correctly passed in the create payload
- Verify the response data (`{ data }`) is returned correctly and has an `id`

**Fix Plan:**
1. Add error logging to `handleCreateGroup` in `team/page.tsx`
2. Verify RLS policy for `member_groups` INSERT allows the current user's church
3. Check migration 022 exists and was applied (check `supabase/migrations/`)
4. Verify the supabase schema has the `member_groups` table
5. Add after-create verification: immediately fetch the group by ID to confirm persistence

### 9.7 🟢 Dashboard Bubbles Don't Navigate

**Status: ⚠️ Bug (already exists) / Enhancement**

**Location:** `src/app/(app)/dashboard/page.tsx`

**Description:** The four stat boxes at the top (Total Services, Songs in Library, Team Members, Upcoming This Week) are decorative cards — they don't navigate to their respective pages when clicked.

**Fix Plan:**
1. Add `cursor="pointer"` and `onClick` handlers to each `StatBox` component
2. Map each stat box to its page:
   - Total Services → `/services`
   - Songs in Library → `/songs`
   - Team Members → `/team`
   - Upcoming This Week → `/services`
3. Apply the same navigation pattern used in the "Quick Actions" section below the stat boxes (which already navigate correctly)

### 9.8 🔴 Private Notes on Team Member Cards Don't Save

**Status: ⚠️ Bug**

**Location:** `src/app/(app)/team/[id]/TeamMemberDetailClient.tsx`

**Description:** The "Private Notes" section on the team member detail page doesn't persist notes. The note creation appears to succeed (toast says "saved") but notes disappear on page reload.

**Root Cause Analysis:**
- Check `store.memberNotes.create()` in `src/lib/store.ts:1897-1900`
- Verify the `team_member_notes` table exists (migration 023)
- Check RLS policy for INSERT on `team_member_notes`
- Verify the `author_user_id` is correctly passed and matches the current user
- The note is optimistically added to state (`setNotes(prev => [{...created, authorName: user.name}, ...prev])`) but the server response might not include the `id`

**Fix Plan:**
1. Add error logging to `handleAddNote`
2. Verify `store.memberNotes.create()` returns the created record with `id`
3. Check RLS policies on `team_member_notes` table
4. Verify migration 023 was applied
5. If RLS blocks the insert or the returned data is malformed, fix accordingly

### 9.9 🟡 Profile Setup Walkthrough on First Signup

**Status: ⚠️ Partially Implemented**

**Current State:** Onboarding checklist exists (`OnboardingChecklist.tsx`) but no guided profile setup flow with step-by-step wizard.

**Description:** When a new volunteer signs up (via invitation or self-signup), they should go through a "Setup Your Profile" flow before seeing the app.

**Fix Plan:**
1. Create `src/components/onboarding/ProfileSetupWizard.tsx`:
   - Step 1: Name (pre-filled from invitation) & optional profile picture
   - Step 2: Phone number
   - Step 3: Role preferences / what they do
   - Step 4: Brief explanation of how navigation works + tour trigger
2. Check if `user.name` is set; if not, force setup
3. Store `profile_setup_completed` as a flag on the user record or a localStorage key
4. After profile setup, auto-start the volunteer-specific tour
5. If user skips, show a dismissible banner "Complete your profile"

---

## 10. Volunteer Onboarding Journey

**Status: ❌ Not Implemented**

### Overview
A structured onboarding flow for new volunteers that cross-sells every feature and ensures they're prepared for their first service.

### Proposed Implementation

#### 10.1 Onboarding Phases

**Phase 0: Account Creation**
- User accepts invite or self-signs up
- Profile setup wizard (name, phone, photo) — see section 9.9
- Role selection/conformation

**Phase 1: Platform Tour**
- Volunteer-specific walkthrough (see section 9.2)
- Covers: Dashboard, My Tasks, Service View (Schedule, Chat), Songs (my charts), Team

**Phase 2: First Service Preparation**
- "Your first service is in X days" banner on dashboard
- Checklist: confirm assignment, review charts, join service chat
- Tooltip guidance on each step

**Phase 3: Post-Service**
- Debrief prompt after first service
- "How did it go?" quick survey
- Unlock training content based on role

#### 10.2 Data Model
```sql
ALTER TABLE team_members ADD COLUMN onboarding_step text DEFAULT 'invited';
ALTER TABLE team_members ADD COLUMN profile_setup_completed boolean DEFAULT false;
ALTER TABLE team_members ADD COLUMN tour_completed boolean DEFAULT false;
```

#### 10.3 Completion Tracking
- Admin view: see each member's onboarding progress
- "X of Y team members have completed onboarding"

---

## 11. About / How-To Section

**Status: ⚠️ Basic FAQ page exists at `/support`**

### Current State
`src/app/support/page.tsx` has a basic FAQ with 5 questions, email support link, and chat support link. Not structured for admins vs. volunteers.

### Proposed Overhaul

#### 11.1 Role-Based Help
- **Admin Help Page** (`/help/admin`):
  - Getting Started: creating your first service, adding songs, scheduling team members
  - Service Planning: drag-and-drop, templates, statuses
  - Team Management: adding members, roles, groups, permissions
  - Songs & Arrangements: adding, editing, ChordPro, files
  - Scheduling: assignments, confirm/decline, reminders, preferences, blockouts
  - Reports: participation, song usage, task completion
  - Settings: church info, billing, integrations, multi-admin
  - Chat: creating channels, managing members, polls, announcements
  - Tasks: creating, assigning, templates, priorities, dependencies
  - Debriefs: setting up, reviewing, trends
  - Service Mode: going live, running the service
- **Volunteer Help Page** (`/help/volunteer`):
  - Getting Started: profile setup, tour, navigation
  - My Tasks: finding tasks, completing them
  - Service View: schedule, confirming, chatting, charts
  - Songs: finding my charts, transposing, downloading
  - Preferences: setting availability, blockout dates
  - Debriefs: submitting feedback
  - Offline Access: downloading charts for offline use

#### 11.2 Help Content Format
- Short written guides with screenshots
- Embedded YouTube tutorial videos
- Searchable FAQ
- "Contact Support" at the bottom of each section
- Keyboard shortcut reference for desktop users

#### 11.3 Implementation
- Convert to a dedicated `/help` route with role-based sub-routes
- Use markdown files for content (easy to edit)
- `src/app/(app)/help/page.tsx` for admin
- `src/app/(app)/help/volunteer/page.tsx` for volunteer
- Detection of user role redirects to the right page
- Search cross all help content

---

## 12. Plan-Change Notifications Enhancements

**Status: ✅ Implemented — `planChanges.ts` + `send-plan-change` API route exist**

### Current State
- `src/lib/planChanges.ts` computes diffs: key changes, item added/removed
- `src/app/api/notifications/send-plan-change/route.ts` sends notifications
- Notification type `plan_change` exists in schema

### Proposed Enhancements

#### 12.1 "Notify Team of This Change?" Prompt
- When saving a service, compute pending changes using `computeKeyChange()`, `computeItemAdded()`, `computeItemRemoved()`
- Show a modal/toast: "Plan changes detected. Notify team members?"
- Options: "Notify All" | "Notify Changed Members Only" | "Don't Notify"
- If confirmed, batch-send notifications via existing pipeline

#### 12.2 Rich Diff Format
Instead of "Plan updated", show:
```
Changes to Sunday Service:
  • "Great Are You Lord" key changed: G → A
  • "Way Maker" added (position 4)
  • "Amazing Grace" removed
  • Service start time changed: 9:00 → 10:00
```

#### 12.3 Email Template
Create a dedicated email template (`src/lib/email-templates.ts`) for plan changes with:
- Service name, date, time
- Bulleted list of changes
- Link to view service
- "Ignore this if..." note

#### 12.4 Notification Channels
- Respect each user's notification preferences (in-app, email, SMS, push)
- In-app: notification badge + notification center entry
- Email: formatted change summary
- SMS: brief "Plan updated for Sunday — check the app" (if enabled)

---

## 13. CCLI SongSelect API Integration

**Status: ⚠️ Manual CCLI numbers stored, ChordPro import from exports works — no API integration**

### Current State
- CCLI number is stored on songs (manual entry)
- Song usage tracking and CSV export exist
- ChordPro import from SongSelect copy-paste works

### Proposed Implementation

#### 13.1 API Integration Strategy
CCLI SongSelect does not have a public REST API for searching their catalog. However:
- **Alternative 1:** Web scraping of CCLI search (fragile, avoid if possible)
- **Alternative 2:** Build a large curated database of public domain songs and common CCLI songs
- **Alternative 3:** Use the existing manual import flow but improve it with better UX
- **Alternative 4:** ChordPro import from popular sites (WorshipTogether, PraiseCharts, etc.)

**Recommended approach:** Focus on enhancing the manual import experience and building a local song database rather than trying to integrate with CCLI's non-existent API.

#### 13.2 Enhanced Song Import Flow
1. User types song title + artist
2. Search local database first (songs already in the church library)
3. Show suggestions from other common worship songs (curated seed database)
4. If no match, user can:
   - Create a new song manually
   - Import ChordPro from paste
   - Import from file upload (.cho, .chordpro, .pdf)
5. CCLI number field remains manual entry but surfaces a reminder: "Add CCLI number for reporting"

#### 13.3 Worship Song Seed Database
- Pre-seed the app with 200+ common worship songs (public domain + CCLI-licensed with proper attribution)
- Songs organized by: artist, key, tempo, theme (Easter, Advent, etc.)
- Each song has at least one arrangement and basic chord chart
- On church signup, optionally pre-populate the song library with these

#### 13.4 CSV / Planning Center Import
- Import songs from Planning Center (see Phase 3 roadmap)
- CSV import from other tools
- Bulk import via file upload

---

## 14. Service Debrief / Retrospective Enhancements

**Status: ✅ Exists — `ServiceDebriefForm.tsx`, debriefs page, migration 036, types defined**

### Current State
- Debrief form with ratings (1-5) for engagement, flow, tech
- Text fields: what went well, what broke, what to change
- Timing comparison (planned vs actual per service item)
- Debrief history at `/services/debriefs/`
- Service-level trends (avg ratings by period)
- Auto-prompt on service completion

### Proposed Enhancements

#### 14.1 One-Click Rating (Post-Service Quick Feedback)
- After marking service as "completed", show a simplified rating bar (1-5 stars for "Overall") right in the service detail view
- Optional: expand into full debrief form
- Mobile-optimized: bottom sheet with quick rating, no page navigation

#### 14.2 Service Log / Trends Dashboard
- Dedicated "Service Log" view at `/reports/debriefs` showing all debriefs
- Graphs: rating trends over time (line chart using Recharts, already a dependency)
- Rolling averages: "Last 4 weeks average engagement: 4.2"
- Compare: "This month's flow rating (4.5) vs. last month (3.8)"
- Lowest-rated areas identified: e.g., "Tech consistently lowest-rated category"

#### 14.3 Automatic Action Items from Debriefs
- When "what broke" or "what to change" mentions specific roles/system, auto-create a task
- Example: "Monitor went out during soundcheck" → creates a task "Check monitor before next service"
- Action items view: all action items generated from debriefs, filterable by status (open/closed)

#### 14.4 Timing Accuracy Reports
- For each service with debriefs, show planned vs actual timing
- "Average timing deviation: +4.2 minutes"
- Suggest duration adjustments for specific songs based on historical data
- "This song was planned for 4 min but averaged 6 min over the last 3 uses"

#### 14.5 Debrief for All Roles
- Currently triggered on service completion
- Add push/email notification to all assigned members: "How did the service go?"
- Customizable debrief questions per church (admin setting)

---

## 15. Multi-Admin Enhancements

**Status: ✅ Exists — `AdminPermission` type, `settings/admins/` page exists**

### Current State
- `AdminPermission` type has fine-grained permissions:
  - `manage_services`, `manage_songs`, `manage_team`, `manage_templates`
  - `manage_settings`, `manage_billing`, `manage_chat`, `manage_admins`
- Settings page at `src/app/(app)/settings/admins/page.tsx` (currently just redirects to `/settings`)
- RBAC context (`PermissionsContext.tsx`) checks permissions via `admin_permissions` table

### Issues & Enhancements

#### 15.1 UI Exists But Sparse
- The admins settings page at `settings/admins/page.tsx` is just a redirect to `/settings`
- Need a proper UI for managing admin permissions

#### 15.2 Proposed Admin Management UI
- "Admins & Permissions" section in Settings
- List current admins with their permission scopes
- "Add Admin" button → select from team members → choose permission scopes
- Permission scope checkboxes:
  - [ ] Manage Services (create, edit, delete)
  - [ ] Manage Songs (add, edit, delete, upload files)
  - [ ] Manage Team (add, edit, remove members)
  - [ ] Manage Templates (create, edit, delete)
  - [ ] Manage Settings (church info, reminder settings)
  - [ ] Manage Billing (view, change subscription)
  - [ ] Manage Chat (create/edit channels, moderate)
  - [ ] Manage Admins (add/remove other admins)
- "Full Access" toggle that checks all boxes

#### 15.3 Permission Enforcement Audit
- Verify that `PermissionsContext.tsx` correctly checks all `manage_*` scopes
- Each page/component should check the appropriate permission before showing admin controls
- Add permission checks to:
  - Service detail page (delete service, change status)
  - Song detail page (delete song, manage files)
  - Team page (remove members, change roles)
  - Settings pages (modify church settings, manage billing)

#### 15.4 Admin Invitation Flow
- Invite a team member to become an admin
- They receive notification: "You've been granted admin access"
- Admin permissions can be revoked at any time

---

## 16. Dashboard Navigation Improvements

**Status: ✅ Stat boxes exist but don't navigate — quick action buttons do navigate**

### Current State
- Four stat boxes: Total Services, Songs in Library, Team Members, Upcoming This Week
- Quick actions below: New Service, Add Song, Add Member, Song Usage (all navigate correctly)
- My Tasks widget (first 5 tasks)
- Upcoming Services list
- Recently Completed list

### Proposed Enhancement

#### 16.1 Make Stat Boxes Navigable
Add `cursor="pointer"` and `onClick` handlers to `StatBox` component:
```tsx
<StatBox 
  icon={Calendar} 
  label="Total Services" 
  value={services.length} 
  onClick={() => router.push('/services')} 
/>
```

#### 16.2 Dashboard Widgets
- Configurable widget layout (admin can choose what to show)
- "Upcoming Schedule" widget: compact calendar showing next 7 days of services with assignment counts
- "My Week" view for volunteers: schedule + tasks + upcoming rehearsals
- "Task Completion Rate" gauge for admins
- "Pending Confirmations" count (how many assignments are still unconfirmed)
- "Recent Activity" feed: recent assignment changes, chat messages, debriefs

#### 16.3 Smart Dashboard for Volunteers
- Currently volunteers see limited view (assigned services only, no stats)
- Enhance volunteer dashboard with:
  - "My Next Service" countdown card
  - "My Assignments" list for today/this week
  - Quick access to "My Charts" for assigned songs
  - Unread chat messages count

#### 16.4 Empty State Improvements
- First-time user: "Welcome to WorshipCenter!" with setup checklist
- No upcoming services: "No services planned yet — check back soon"
- No tasks: "You're all caught up!" with confetti animation

---

## 17. Auto-Scheduling / "Suggest a Volunteer"

**Status: ❌ Not Implemented — planned in Feature Roadmap Phase 3.3**

### Current State
No deterministic rotation algorithm exists. Scheduling is fully manual. Roadmap mentions `member_role_stats` view for Phase 3.3 but it hasn't been built.

### Proposed Implementation (Pull Forward to Now)

#### 17.1 Database View
```sql
CREATE VIEW member_role_stats AS
SELECT 
  tm.id AS team_member_id,
  tm.name AS member_name,
  tm.roles,
  sa.role,
  COUNT(*) FILTER (WHERE sa.status = 'confirmed') AS confirmed_count,
  MAX(s.confirmed_at) AS last_served_at
FROM team_members tm
LEFT JOIN service_assignments sa ON sa.team_member_id = tm.id
LEFT JOIN services s ON s.id = sa.service_id
WHERE tm.church_id = $1
GROUP BY tm.id, tm.name, tm.roles, sa.role;
```

#### 17.2 Rank Algorithm (No ML, No Paid AI)
```
For each unfilled role on a service:
  1. Filter team members who have this role in their roles[] array
  2. Exclude members with active blockout dates covering the service date
  3. Exclude members already assigned to a conflicting service
  4. Score remaining candidates:
     - Base score: 100
     - Subtract 10 for each confirmed service in the last 90 days
     - Subtract 5 for each pending (unconfirmed) assignment
     - Add 20 if max_weekly_frequency allows more this week
     - Add bonus if longest since last served
  5. Return top 3 ranked candidates
```

#### 17.3 UI Integration
- "Suggest" button next to each unfilled role in `ServiceSchedule.tsx`
- Click → shows top 3 candidates with their scores/reasoning
  - "[Name] · 2 services this month · Last served 3 weeks ago"
  - "[Name] · 0 services this month · Never served this role"
  - "[Name] · Available · 4 services this month (at limit)"
- "Assign" button next to each candidate
- "Auto-fill Service" button that fills ALL unfilled roles with top candidates
- "Auto-escalation" on declined/unconfirmed: when a member declines, the next-ranked member is automatically suggested

#### 17.4 Auto-Escalation Flow
- Extend `src/lib/reminders.ts` to track declined/unconfirmed assignments
- When a member declines, trigger `scheduling/suggest.ts` to get next candidate
- Send notification to admin: "[Member] declined [Role]. [Next Candidate] suggested."
- Auto-assign if admin has enabled "auto-assign on decline" setting

---

## 18. Training Hub & Volunteer Pathways

**Status: ❌ Not Implemented — planned in Roadmap Phase 2.3 / 3.4**

For full details, see `docs/FEATURE_ROADMAP.md` (Phase 2.3 and 3.4). Summary below:

### MVP Scope
- New "Training" nav item
- Videos organized by role (Vocals, Guitar, Drums, Keys, Sound, Media) and level (Beginner/Intermediate/Advanced)
- YouTube embeds only (free)
- Worship leaders can create "Courses" = ordered playlists
- Progress tracking: mark video as watched

### Extended Scope (Pathways)
- Pathway templates per role (e.g., "New Sound Tech Pathway": 3 videos + 1 quiz)
- Simple multiple-choice quizzes with pass threshold
- Enrollment forms — lightweight form that auto-enrolls into the right pathway
- Pathway completion certificates (PDF generation)

### Implementation Note
- Do NOT rebuild what already exists: the song library and rehearsal tracking provide the foundation
- Training videos for songs: reuse existing song YouTube embeds
- Integration with debrief system: "You might want to review the training on monitors" when tech debrief scores low

---

## 19. Support / Help Center Overhaul

**Status: ⚠️ Basic FAQ at `/support`**

### Current State
`/support/page.tsx` has 5 FAQ items, email support link, and in-app chat support link. No role-based content, no search, no tutorials.

### Proposed Features
- Role-based routing: admin vs volunteer help content
- Searchable knowledge base (client-side search across all help articles)
- Help content stored as markdown in `/docs/help/` or in a `help_articles` DB table
- Video tutorials section (YouTube embeds)
- "Contact Support" form that creates an in-app support ticket
- Keyboard shortcut reference

---

## 20. Global App-Wide Enhancements

### 20.1 Service Mode (Live Dashboard)
- ✅ Exists with basic functionality
- Enhancements needed:
  - Countdown timer per item auto-advance
  - "Run sheet" PDF export for printing
  - Presenter notes support
  - Better mobile view with swipe to advance
  - Cast to external display (AirPlay/ChromeCast)

### 20.2 Search Enhancements
- Global search (Cmd+K / Ctrl+K) across services, songs, team members, tasks
- Spotlight-style search overlay
- Search songs by key, tempo, tags, CCLI number
- Search services by date range, title, status

### 20.3 Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `?` | Show keyboard shortcuts |
| `Cmd+K` | Global search |
| `n` | New service |
| `s` | Go to services |
| `t` | Go to tasks |
| `m` | Go to team |
| `g` then `d` | Go to dashboard |
| `g` then `s` | Go to songs |

### 20.4 Performance & UX
- Skeleton loading states on ALL pages (follow existing pattern in `ServiceDetailClient.tsx`)
- Infinite scroll on long lists (songs, team members, services)
- Debounced search inputs (already partially done)
- Optimistic updates for mutations (already partially done)
- Lazy load non-critical components

### 20.5 Accessibility
- Keyboard navigation for all interactive elements
- Screen reader labels on icon-only buttons
- Focus indicators on all interactive elements
- Color contrast compliance (WCAG AA)
- Reduced motion support (respect `prefers-reduced-motion`)

### 20.6 Error Handling
- Global error boundary with "Something went wrong" + retry button
- Per-page error states (already exists in several pages with `error.tsx`)
- Offline-aware UI (see section 2)
- Graceful degradation when Supabase/API calls fail

---

## Appendix A: Implementation Priority Matrix

| Priority | Feature | Effort | Impact | Dependencies |
|----------|---------|--------|--------|--------------|
| 🔴 P0 | Groups save bug (9.6) | ~2h | High | None |
| 🔴 P0 | Private notes save bug (9.8) | ~2h | High | None |
| 🔴 P0 | Chat notifications bug (9.1) | ~4h | High | None |
| 🟡 P1 | Create channel mobile styling (9.3) | ~2h | Medium | None |
| 🟡 P1 | Completed tasks tab bug (9.4) | ~2h | Medium | None |
| 🟡 P1 | Dashboard bubbles navigation (9.7) | ~1h | Low | None |
| 🟡 P1 | Task click → service item (9.5) | ~3h | Medium | None |
| 🟡 P1 | Profile setup walkthrough (9.9) | ~1d | Medium | Volunteer tour steps |
| 🟡 P1 | Volunteer-specific tour (9.2) | ~1d | Medium | Tour system |
| 🟡 P1 | Volunteer self-signup (1) | ~1w | High | Types, store, notifications |
| 🟡 P1 | Auto-scheduling / Suggest (17) | ~2w | High | `member_role_stats` view |
| 🟡 P1 | Admin management UI (15) | ~1w | High | Permissions system |
| 🟢 P2 | Download bundles (7) | ~1w | Medium | Storage, file types |
| 🟢 P2 | ChordPro editor & transpose (5) | ~2w | High | ChordPro parser |
| 🟢 P2 | Plan-change notification prompt (12) | ~3d | Medium | `planChanges.ts` |
| 🟢 P2 | Scheduling conflicts (3) | ~1w | Medium | ✅ Implemented |
| 🟢 P2 | Mobile file access (8) | ~1.5w | High | Mobile viewer, offline |
| 🟢 P2 | About/help pages (11) | ~1w | Medium | Content writing |
| 🔵 P3 | Offline data access (2) | ~3w | High | Service worker, IndexedDB |
| 🔵 P3 | File upload UX overhaul (4) | ~2w | Medium | Storage, mobile plugins |
| 🔵 P3 | Service debrief enhancements (14) | ~1w | Medium | Debrief system |
| 🔵 P3 | Training hub (18) | ~3w | Medium | YouTube embeds |
| 🔵 P3 | Arrangement file inheritance (6) | ~1w | Medium | Song files schema |
| ⚪ P4 | CCLI SongSelect integration (13) | ~1w | Low | Alternative approaches |
| ⚪ P4 | Volunteer onboarding journey (10) | ~2w | Medium | Multiple systems |
| ⚪ P4 | Global search (20.2) | ~1w | Medium | Search index |
| ⚪ P4 | Keyboard shortcuts (20.3) | ~3d | Low | None |
| ⚪ P4 | Accessibility audit (20.5) | ~2w | Medium | All components |

---

## Appendix B: Feature Status Legend

| Status | Meaning |
|--------|---------|
| ❌ Not Implemented | Feature doesn't exist at all |
| ⚠️ Bug / Partial | Exists but has issues or limited scope |
| ✅ Implemented | Meets initial requirements, may need enhancement |
| ✅ Production-Ready | Fully built, tested, and in use |

---

*This document consolidates all product ideas, feature requests, bug reports, and enhancement suggestions for WorshipCenter. Each section contains detailed implementation specifications, relevant file paths, and actionable next steps. Use this as a living reference when planning sprint work.*
