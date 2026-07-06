# Admin Management & Enhanced Team Chat

## Overview

Three feature groups: (1) admin management with granular permissions, (2) multi-channel team chat replacing the flat chat page, (3) rich messaging (polls, formatting, image uploads, GIF embeds).

---

## Part 1: Admin Management

### Design Decisions

- Granular permissions sit **alongside** the existing role system (`admin`/`leader`/`team` on `users` table).
- `admin_permissions` only applies to users whose `role = 'admin'`. Leaders and team members still get the fixed RBAC matrix in `rbac.ts`.
- `manage_admins` permission is protected: an admin cannot remove `manage_admins` from their own row if they are the only admin with it (enforced at the app layer, not DB).
- The "Add Admin" flow promotes an existing church member to `role = 'admin'` and creates their `admin_permissions` row with default grant of all scopes.

### DB Migration: `042_reconcile_chat_schema_and_admin_permissions.sql`

This migration does **four** things:

1. **Reconcile `chat_messages` schema** — the initial schema (pre-migration-012) has `id, church_id, user_id, content, created_at`. Migration 024 tried to recreate the table with `channel_id` but was a no-op (`CREATE TABLE IF NOT EXISTS`). This migration adds `channel_id` and fixes the broken RLS policies from 024 that referenced `team_members.role` (which doesn't exist — `team_members` only has a `roles[]` array, not a scalar `role`).

   ```sql
   -- Add channel_id to old chat_messages table
   ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES chat_channels(id) ON DELETE SET NULL;
   CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id_v2 ON chat_messages(channel_id);

   -- Drop broken RLS from migration 024 that referenced team_members.role
   DROP POLICY IF EXISTS "Admins/leaders can create channels" ON chat_channels;
   DROP POLICY IF EXISTS "Admins/leaders can update channels" ON chat_channels;
   DROP POLICY IF EXISTS "Admins/leaders can delete channels" ON chat_channels;
   DROP POLICY IF EXISTS "Admins/leaders can manage channel members" ON chat_channel_members;

   -- Recreate with correct users.role reference
   CREATE POLICY "Admins/leaders can create channels"
     ON chat_channels FOR INSERT
     WITH CHECK (
       church_id IN (SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader'))
     );

   CREATE POLICY "Admins/leaders can update channels"
     ON chat_channels FOR UPDATE
     USING (
       church_id IN (SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader'))
     );

   CREATE POLICY "Admins/leaders can delete channels"
     ON chat_channels FOR DELETE
     USING (
       church_id IN (SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader'))
     );

   CREATE POLICY "Admins/leaders can manage channel members"
     ON chat_channel_members FOR ALL
     USING (
       channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (
         SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')
       ))
     )
     WITH CHECK (
       channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (
         SELECT church_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader')
       ))
     );

   -- Fix existing chat_messages RLS to check via channel_id
   DROP POLICY IF EXISTS "Users can view messages in accessible channels" ON chat_messages;
   DROP POLICY IF EXISTS "Users can post messages to accessible channels" ON chat_messages;
   DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;

   CREATE POLICY "Users can view messages in accessible channels"
     ON chat_messages FOR SELECT
     USING (
       channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
       OR (channel_id IS NULL AND church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
     );

   CREATE POLICY "Users can post messages"
     ON chat_messages FOR INSERT
     WITH CHECK (
       user_id = auth.uid()
       AND (
         channel_id IS NULL
         OR channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
       )
     );

   CREATE POLICY "Users can delete their own messages"
     ON chat_messages FOR DELETE
     USING (user_id = auth.uid());
   ```

2. **Create `admin_permissions` table**

   ```sql
   CREATE TABLE IF NOT EXISTS admin_permissions (
       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
       manage_services BOOLEAN NOT NULL DEFAULT TRUE,
       manage_songs BOOLEAN NOT NULL DEFAULT TRUE,
       manage_team BOOLEAN NOT NULL DEFAULT TRUE,
       manage_templates BOOLEAN NOT NULL DEFAULT TRUE,
       manage_settings BOOLEAN NOT NULL DEFAULT TRUE,
       manage_billing BOOLEAN NOT NULL DEFAULT TRUE,
       manage_chat BOOLEAN NOT NULL DEFAULT TRUE,
       manage_admins BOOLEAN NOT NULL DEFAULT TRUE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (user_id)
   );

   ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view own admin permissions"
     ON admin_permissions FOR SELECT
     USING (user_id = auth.uid());

   -- Any admin with manage_admins=true can view all admin_permissions for the church
   CREATE POLICY "Admins can view church admin permissions"
     ON admin_permissions FOR SELECT
     USING (
       EXISTS (
         SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
         AND EXISTS (SELECT 1 FROM admin_permissions ap WHERE ap.user_id = auth.uid() AND ap.manage_admins = TRUE)
       )
     );

   CREATE POLICY "Admins can manage admin permissions"
     ON admin_permissions FOR INSERT
     WITH CHECK (
       EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
     );
   ```

3. **Auto-create `admin_permissions` row on role change**

   ```sql
   CREATE OR REPLACE FUNCTION auto_create_admin_permissions()
   RETURNS TRIGGER AS $$
   BEGIN
       IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
           INSERT INTO admin_permissions (user_id, church_id)
           VALUES (NEW.id, NEW.church_id)
           ON CONFLICT (user_id) DO NOTHING;
       END IF;
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER auto_create_admin_permissions_trigger
       AFTER INSERT OR UPDATE OF role ON users
       FOR EACH ROW
       EXECUTE FUNCTION auto_create_admin_permissions();
   ```

4. **Auto-create "General" channel per church**

   ```sql
   -- Auto-create General channel for churches that don't have one
   INSERT INTO chat_channels (church_id, name, description, type, is_private, created_by)
   SELECT c.id, 'General', 'Main church-wide announcements and discussion', 'channel', FALSE, NULL
   FROM churches c
   WHERE NOT EXISTS (
     SELECT 1 FROM chat_channels cc WHERE cc.church_id = c.id AND cc.name = 'General'
   );
   ```

### DB Migration: `043_chat_message_features.sql`

Rich message features — polls, attachments, reactions, announcement channels.

```sql
-- Announcement flag on channels
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT FALSE;

-- Pinned flag on messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Polls
CREATE TABLE IF NOT EXISTS chat_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    is_multiple_choice BOOLEAN NOT NULL DEFAULT FALSE,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supports both single (app-enforced) and multiple choice
CREATE TABLE IF NOT EXISTS chat_poll_votes (
    poll_id UUID NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id, option_index)
);

-- Attachments
CREATE TABLE IF NOT EXISTS chat_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reactions
CREATE TABLE IF NOT EXISTS chat_reactions (
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_polls_channel_id ON chat_polls(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id ON chat_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message_id ON chat_reactions(message_id);

-- RLS
ALTER TABLE chat_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- Polls: viewable by any user in the church
CREATE POLICY "Users can view polls in accessible channels"
    ON chat_polls FOR SELECT
    USING (channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid())));

-- Polls: users in channel can create polls
CREATE POLICY "Users can create polls in accessible channels"
    ON chat_polls FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
    );

-- Voting
CREATE POLICY "Users can vote on polls"
    ON chat_poll_votes FOR INSERT
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can view poll votes"
    ON chat_poll_votes FOR SELECT
    USING (user_id = auth.uid() OR poll_id IN (SELECT id FROM chat_polls WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));

-- Attachments
CREATE POLICY "Users can view attachments in accessible messages"
    ON chat_attachments FOR SELECT
    USING (message_id IN (SELECT id FROM chat_messages WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));
CREATE POLICY "Users can create attachments"
    ON chat_attachments FOR INSERT
    WITH CHECK (message_id IN (SELECT id FROM chat_messages WHERE user_id = auth.uid()));

-- Reactions
CREATE POLICY "Users can view reactions"
    ON chat_reactions FOR SELECT
    USING (message_id IN (SELECT id FROM chat_messages WHERE channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))));
CREATE POLICY "Users can manage their own reactions"
    ON chat_reactions FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Announcement-channel message restriction: only admins/leaders can post to announcement channels
DROP POLICY IF EXISTS "Users can post messages" ON chat_messages;
CREATE POLICY "Users can post messages"
    ON chat_messages FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND channel_id IN (SELECT id FROM chat_channels WHERE church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
        AND (
            (SELECT is_announcement FROM chat_channels WHERE id = channel_id) = FALSE
            OR (
                (SELECT is_announcement FROM chat_channels WHERE id = channel_id) = TRUE
                AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'leader'))
            )
        )
    );

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
```

### Types: `src/lib/types.ts`

Add:
- `AdminPermission` — mirrors the table columns
- `ChatChannelWithMeta extends ChatChannel` — adds `lastMessage`, `lastMessageAt`, `unreadCount`, `memberCount`
- `ChatMessageFull extends ChatChannelMessagePopulated` — adds `attachments: ChatAttachment[]`, `reactions: ChatReaction[]`, `is_pinned`
- `ChatPoll`, `ChatPollVote`, `ChatAttachment`, `ChatReaction` — mirror DB tables

### Store: `src/lib/store.ts`

- `db.adminPermissions` with `getByChurch(churchId)`, `getByUser(userId)`, `upsert(userId, churchId, perms)`
- `db.channels` — extend existing methods:
  - `getByChurch(churchId)` — add last-message preview and member count
  - `create(c)` — include `is_announcement`
  - `getOrCreateGeneral(churchId)` — create General channel if not exists
  - `sendMessage(channelId, userId, content, attachment?)` — insert into chat_messages, optionally create attachment
  - `pinMessage(messageId, isPinned)`
  - `getPolls(channelId)`, `createPoll(...)`, `votePoll(pollId, userId, optionIndex)`
  - `addReaction(messageId, userId, emoji)`, `removeReaction(messageId, userId, emoji)`
  - `subscribe(channelId, callback)` — realtime subscription for new messages in a channel

### RBAC: `src/lib/rbac.ts`

Add `hasScopePermission(userRole, userPermissions, scope): boolean`:
- If role !== 'admin', fall back to existing `hasPermission` logic
- If role === 'admin', check the `admin_permissions` row
- Returns `true` if user has access to the given scope

### UI: `src/app/(app)/settings/admins/page.tsx`

New page, only accessible to users with `role = 'admin'` AND `manage_admins = true`.

- Header: "Admin Management" + "Add Admin" button
- Table/rows of existing admins showing:
  - Name, email, role badge
  - Toggle switches for each scope
  - "Remove Admin" button
- "Add Admin" modal: search/pick from church users, confirm promote to admin
- "Remove Admin" confirms then demotes to `role = 'leader'`
- Nav link in sidebar: `AppShell.tsx` conditionally renders "Admin" -> `/settings/admins`

---

## Part 2: Multi-Channel Chat

### Architecture

The existing chat page (`chat/page.tsx`) is a flat church-wide chat using `chat_messages.church_id`. We replace it with a channel-based layout using `chat_messages.channel_id`.

**Migration path**: The `042` migration above adds `channel_id` to the existing table and creates a "General" channel per church. Old messages get the General channel assigned. The new chat page filters by `channel_id` instead of `church_id`, so all history is preserved.

### Chat Page Rewrite: `src/app/(app)/chat/page.tsx`

Three-panel layout (desktop):
```
┌─────────────┬───────────────────┬─────────────┐
│ Channel List │    Messages       │  Channel    │
│  # general   │   (date groups,   │  Info Panel │
│  📢 announcements│   bubbles,     │  (members,  │
│  🔒 worship-band│   reactions)    │   pinned)   │
│              │                   │             │
│ [+ Create]   │  [Rich Input]     │             │
└─────────────┴───────────────────┴─────────────┘
```
- **Mobile**: Channel list is a drawer, channel info is a bottom sheet
- **Empty state**: If no channels exist, show "Create your first channel" with the auto-create General suggestion

### Components (`src/components/chat/`)

| Component | Responsibility |
|-----------|---------------|
| `ChannelList.tsx` | Left sidebar: channel list grouped by type (channels, announcements, groups), "Create Channel" button (admin/leader only), active channel highlighting, unread counts |
| `ChannelCreateModal.tsx` | Form: name, description, type (channel/group), is_announcement toggle, member picker for private groups |
| `ChannelHeader.tsx` | Channel name, description, member count, announcement badge, actions (pin, invite) |
| `MessageList.tsx` | Scrollable message list with date separators, auto-scroll, infinite scroll for history, typing indicator, pinned indicator |
| `MessageBubble.tsx` | Single message: sender avatar, name, content (rendered with text styling), attachments (image thumbnails), reactions row (click to add), timestamp, context menu (report, pin) |
| `ChatInput.tsx` | Composer with: textarea, formatting toolbar (B/I/S toggle buttons), image upload button, GIF button, poll button, emoji button, send button. Composes content as Markdown-like syntax. |
| `PollModal.tsx` | Modal: poll question + dynamic options list (add/remove), multiple choice toggle |
| `GifPicker.tsx` | Search input fetching from `/api/chat/giphy`, grid of GIF thumbnails, clicking inserts GIF URL as `![gif](url)` |
| `EmojiPicker.tsx` | Popover grid of ~50 common emojis, inserts `:emoji:` or Unicode |
| `ChannelInfo.tsx` | Right sidebar: member list (with role badges), pinned messages list, leave channel button |
| `ReactionBar.tsx` | Small row beneath message showing existing reactions with counts, "+" button to pick more |

### Rich Input Text Styling

Messages support inline Markdown-like formatting. A simple client-side renderer (regex-based, no external dep) converts:
- `**bold**` → `<strong>`
- `*italic*` → `<em>`
- `~~strikethrough~~` → `<del>`
- `` `code` `` → `<code>`
- `![gif](url)` → rendered as GIF image (inline)
- `![image](url)` → rendered as image (inline)

The ChatInput toolbar has toggle buttons that wrap selected text or insert the markers at cursor position.

### Image Upload Flow

1. User clicks image upload button → system file picker
2. Client-side: canvas resizes to max 1920px on longest side, JPEG at quality 0.8
3. Upload to Supabase Storage bucket `chat-images` via a server action or direct upload
4. Server validates mime type, enforces max 5MB
5. Returns public URL → inserted as `![image](url)` into message content
6. On render, the URL is detected and shown as an inline image

### GIF Flow

1. User clicks GIF button → `GifPicker` opens
2. Searches GIPHY via `GET /api/chat/giphy?q=<query>` (server-side proxy that holds the API key)
3. Returns array of `{url, previewUrl, width, height}`
4. User selects a GIF → inserts `![gif](giphy_url)` into message
5. On render, the URL is detected, embedded as an `<img>` showing the GIF

The GIPHY proxy API route: `src/app/api/chat/giphy/route.ts`
- Reads `GIPHY_API_KEY` from env
- Calls `https://api.giphy.com/v1/gifs/search`
- Returns sanitized results

### Announcement Channels

- Created with `is_announcement = true` (only admins/leaders can set this)
- RLS on `chat_messages` prevents non-admin/leader from inserting
- In the UI: show megaphone icon, "Announcement" badge in header, disable input for non-admins
- Display help text: "Only admins and leaders can post in this channel"

### Realtime Subscriptions

- `db.channels.subscribe(channelId, onMessage)` uses Supabase's `postgres_changes` on `chat_messages` filtered by `channel_id`
- Also subscribe to `chat_reactions` and `chat_attachments` for live updates
- Fallback polling every 30s if WebSocket fails (same pattern as existing chat)

---

## Part 3: File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/042_reconcile_chat_schema_and_admin_permissions.sql` | Schema reconciliation + admin_permissions + General channel |
| `supabase/migrations/043_chat_message_features.sql` | Polls, attachments, reactions, announcement RLS |
| `src/app/(app)/settings/admins/page.tsx` | Admin management UI page |
| `src/components/chat/ChannelList.tsx` | Channel sidebar |
| `src/components/chat/ChannelCreateModal.tsx` | Create channel form modal |
| `src/components/chat/ChannelHeader.tsx` | Channel header bar |
| `src/components/chat/MessageList.tsx` | Message list with auto-scroll |
| `src/components/chat/MessageBubble.tsx` | Individual message with reactions |
| `src/components/chat/ChatInput.tsx` | Rich composer |
| `src/components/chat/PollModal.tsx` | Poll creation form |
| `src/components/chat/GifPicker.tsx` | GIF search modal |
| `src/components/chat/EmojiPicker.tsx` | Emoji popover |
| `src/components/chat/ChannelInfo.tsx` | Channel info sidebar |
| `src/components/chat/ReactionBar.tsx` | Message reactions row |
| `src/components/chat/MarkdownRenderer.tsx` | Simple regex-based text renderer |
| `src/app/api/chat/giphy/route.ts` | GIPHY search proxy |

### Modified Files

| File | What changes |
|------|-------------|
| `src/lib/types.ts` | Add AdminPermission, ChatChannelWithMeta, ChatMessageFull, ChatPoll, ChatPollVote, ChatAttachment, ChatReaction |
| `src/lib/store.ts` | Add adminPermissions CRUD, extend channels with full feature support |
| `src/lib/rbac.ts` | Add `hasScopePermission()` |
| `src/app/(app)/chat/page.tsx` | Full rewrite to channel-based three-panel layout |
| `src/components/layout/AppShell.tsx` | Add "Admin" nav link (visible when `role=admin & manage_admins`) |
| `src/lib/demo/context.tsx` | Add demo handlers for new chat features |
| `src/lib/demo/data.ts` | Add demo channels, polls, reactions |

### No Changes Needed

| File | Reason |
|------|--------|
| `src/components/layout/BottomNav.tsx` | Chat nav link unchanged |
| `src/lib/auth.tsx` | No auth changes needed |
| `.env.vercel.example` | Add `GIPHY_API_KEY` |

---

## Implementation Order

```
Step 1: Migration 042 (schema reconciliation + admin_permissions + General channel)
Step 2: Migration 043 (polls, attachments, reactions, announcement RLS)
─── Types & Store ───
Step 3: Add AdminPermission, ChatPoll, etc. types to types.ts
Step 4: Add adminPermissions CRUD to store.ts; add hasScopePermission to rbac.ts
Step 5: Extend db.channels in store.ts with all new feature methods
─── APIs ───
Step 6: Create src/app/api/chat/giphy/route.ts
─── Admin UI ───
Step 7: Create src/app/(app)/settings/admins/page.tsx
Step 8: Add "Admin" nav link to AppShell.tsx
─── Chat Components (bottom-up) ───
Step 9: MarkdownRenderer.tsx — regex text formatting
Step 10: EmojiPicker.tsx
Step 11: GifPicker.tsx
Step 12: PollModal.tsx
Step 13: ChatInput.tsx — rich composer combining all input features
Step 14: MessageBubble.tsx — message with reactions + attachments
Step 15: ReactionBar.tsx
Step 16: MessageList.tsx — scrollable list with date separators
Step 17: ChannelHeader.tsx
Step 18: ChannelInfo.tsx
Step 19: ChannelCreateModal.tsx
Step 20: ChannelList.tsx — sidebar
─── Chat Page ───
Step 21: Rewrite chat/page.tsx — wire all components into three-panel layout
─── Demo Support ───
Step 22: Update demo/context.tsx + demo/data.ts for new features
```

## Validation

- Admin with `manage_admins=false` cannot access `/settings/admins` (redirect to dashboard)
- Promoting a user to admin auto-creates admin_permissions row (verify via DB)
- Old chat messages appear inside the "General" channel
- Non-admin user sees collapsed input on announcement channels
- GIF picker returns results from GIPHY proxy
- Image upload compresses client-side before upload
- Poll votes persist and display aggregated results
- Reactions toggle on click (add if absent, remove if present)
- Channel subscription delivers new messages in realtime
- Mobile layout shows drawer for channel list, renders all features
