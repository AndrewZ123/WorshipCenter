# Mobile Chat Redesign — Implementation Plan

## Goal

Adapt the WorshipCenter chat experience for mobile: multi-channel navigation, gesture interactions, bottom sheets, and shared component reuse. The work targets both the real chat (`(app)/chat/`) and the demo chat (`demo/chat/`).

---

## Phase 1 — Data & Foundation

### Task 1.1 — Fix demo seed messages to include `channel_id`

**File:** `src/lib/demo/data.ts`

The 5 `DEMO_CHAT_MESSAGES` lack a `channel_id` field. This causes them to appear in every channel via the fallback filter in store.ts. Assign them to the `general` channel.

```typescript
// Add channel_id: 'ch-general' to each of the 5 seed messages
{ id: 'chat-1', channel_id: 'ch-general', church_id: ..., user_id: ..., content: ..., created_at: ..., user: ... }
```

### Task 1.2 — Add `channel_id` to demo `createChatMessage`

**File:** `src/lib/demo/context.tsx`

The `createChatMessage` function (line 493) currently accepts `Omit<ChatMessage, 'id' | 'created_at'>` — `ChatMessage` doesn't include `channel_id`. Add `channel_id` to the accepted type and persist it on the created message.

Change signature:
```typescript
createChatMessage: (message: Omit<ChatMessage, 'id' | 'created_at'> & { channel_id?: string }) => ChatMessagePopulated;
```

Add `channel_id: message.channel_id || null` to the returned object.

### Task 1.3 — Add `channel_id` to `ChatMessage` type

**File:** `src/lib/types.ts`

Add optional `channel_id?: string` to `ChatMessage` and `ChatMessagePopulated` interfaces.

### Task 1.4 — Export shared chat components from barrel

**File:** `src/components/chat/index.ts` (create)

Export all chat components so the demo page can import them cleanly:
```typescript
export { default as ChannelList } from './ChannelList';
export { default as ChannelHeader } from './ChannelHeader';
export { default as ChannelInfo } from './ChannelInfo';
export { default as ChannelCreateModal } from './ChannelCreateModal';
export { default as MessageList } from './MessageList';
export { default as MessageBubble } from './MessageBubble';
export { default as ChatInput } from './ChatInput';
```

---

## Phase 2 — New Mobile Components

### Task 2.1 — Create `ChannelPillBar` component

**File:** `src/components/chat/ChannelPillBar.tsx` (new)

A horizontally scrollable row of channel pills for the mobile chat top area.

```tsx
interface ChannelPillBarProps {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelect: (channel: ChatChannel) => void;
}
```

Behavior:
- Horizontal `Flex` with `overflowX="auto"` and `scrollSnapType="x proximity"`
- Each pill: `px="3" py="1.5" borderRadius="full" fontSize="sm"`
- Active pill: filled `teal.500` bg, white text
- Inactive pill: outlined, gray border, gray text
- Contains channel icon (Hash/Megaphone/Lock) + name
- Unread dot indicator (small teal circle) — future-proof prop
- Min height 44px for touch targets
- Scrollable with `gap="2"` and horizontal padding
- Fixed height, no line clamping — just truncate with ellipsis

### Task 2.2 — Create `ChannelBottomSheet` component

**File:** `src/components/chat/ChannelBottomSheet.tsx` (new)

A Chakra `Drawer` with `placement="bottom"` that shows the full channel list for mobile discovery.

```tsx
interface ChannelBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelect: (channel: ChatChannel) => void;
  canCreate: boolean;
  onCreateClick: () => void;
}
```

Behavior:
- Drawer with `placement="bottom"`, rounded top corners (`borderTopRadius="2xl"`)
- Search `Input` at top that filters channels by name as you type
- Sections: Channels, Announcements, Private (same grouping as `ChannelList`)
- Each row: icon + name + brief description (1 line) + unread badge
- Tap row → `onSelect(channel)` + `onClose()`
- "Create Channel" button at bottom (if `canCreate`)
- Overlay backdrop with blur
- Drawer height: 60% of screen (`h="60dvh"`)

### Task 2.3 — Create `MessageActionSheet` component

**File:** `src/components/chat/MessageActionSheet.tsx` (new)

A bottom sheet action menu triggered by long-press on a message (mobile replacement for the hover kebab menu).

```tsx
interface MessageActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isOwn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  onCopy?: () => void;
}
```

Behavior:
- Chakra `Drawer` with `placement="bottom"`, minimal height, rounded top
- "React" row: horizontal emoji strip (👍 ❤️ 😂 😮 😢 🙏 + custom)
- Divider
- "Edit" item (only if `isOwn && onEdit`) with `Pencil` icon
- "Copy" item with `Copy` icon
- "Delete" item (only if `isOwn && onDelete`) with `Trash2` icon, red text
- Tap any item → action + `onClose()`
- Tap backdrop → `onClose()`

### Task 2.4 — Update `MessageBubble` for mobile long-press

**File:** `src/components/chat/MessageBubble.tsx`

Changes:
- Wrap the message bubble container in a `motion.div` with `onContextMenu` and `onTouchStart` timer-based long-press detection
- Long press (500ms) on touch devices → opens `MessageActionSheet`
- On mobile: hide the kebab menu (`MoreVertical`) since hover doesn't work
- On mobile: always show reactions below the bubble (remove the `_groupHover` wrapper)
- On desktop: keep existing behavior unchanged

Detection approach:
```tsx
const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
const handleTouchStart = () => { longPressTimer.current = setTimeout(() => setIsActionOpen(true), 500); };
const handleTouchEnd = () => { clearTimeout(longPressTimer.current); };
```

---

## Phase 3 — Demo Chat Refactor

### Task 3.1 — Rewrite `demo/chat/page.tsx`

**File:** `src/app/demo/chat/page.tsx`

Replace the entire file with a refactored version that:
- Imports from `@/components/chat` barrel (ChannelHeader, MessageList, ChatInput, ChannelCreateModal)
- Uses demo's `chatChannels` and `chatMessages` from `useDemo()`
- Maintains `activeChannel` state (default to first channel)
- Shows `ChannelHeader` for the active channel
- Shows `ChannelPillBar` on mobile, `ChannelList` on desktop (same pattern as real chat)
- Shows `MessageList` with demo message/CRUD passthroughs
- Shows `ChatInput` with demo send handler
- Uses `Drawer` with `placement="bottom"` for channel selection on mobile
- Reuses existing demo store's `channels.sendMessage` / `channels.getMessages` via the `useStore()` hook
- Removes the duplicate `MessageBubble`, `TypingIndicator`, `groupMessagesByDate`, `DateSeparator` local definitions

The refactored page should be ~150-200 lines (down from 611).

### Task 3.2 — Wire demo channel data through demo store

**File:** `src/lib/demo/store.ts`

The `channels.getMessages` method (line 798) already correctly filters by `channel_id`. No changes needed here — seed messages with `channel_id` (Task 1.1) will naturally appear in the right channel.

The `channels.sendMessage` (line 804) already includes `channel_id`. No changes needed.

The `channels.getByChurch` (line 756) already returns demo channels from context. No changes needed.

### Task 3.3 — Ensure demo channel creation works

**File:** `src/lib/demo/context.tsx`

Add a `createChannel` action (similar to `createChatMessage`) if one doesn't exist. Currently, `chatChannels` state has no mutator exposed beyond direct array mutation in store.ts. The store's `channels.create` (store.ts line 764) pushes directly to `demo.chatChannels` — this works because it mutates the array reference. However, React may not re-render since `chatChannels` state isn't updated via setter.

Fix: Add `setChatChannels` override in store's `channels.create`:
```typescript
// In store.ts channels.create, after pushing:
const newState = [...getDemoContext().chatChannels, newChannel];
// This won't trigger re-render — need a setter exposed from context
```

**Alternatively:** Add a `createChannel` callback to `DemoContextType` and expose it. Then update store's `channels.create` to call it.

---

## Phase 4 — Real Chat Mobile Enhancements

### Task 4.1 — Add mobile ChannelPillBar to real chat page

**File:** `src/app/(app)/chat/page.tsx`

After the mobile header (line 318-336), add `ChannelPillBar` on mobile:
```tsx
<Box display={{ base: 'block', lg: 'none' }}>
  <ChannelPillBar
    channels={channels}
    activeChannelId={activeChannel?.id || null}
    onSelect={(ch) => setActiveChannel(ch)}
  />
</Box>
```

### Task 4.2 — Add channel bottom sheet to real chat page

**File:** `src/app/(app)/chat/page.tsx`

Replace the current left-side `Drawer` (lines 287-301) with two variants:
- Mobile: `ChannelBottomSheet` (bottom drawer for channel discovery)
- Desktop: keep existing left-side `ChannelList` in a `Drawer` (hamburger)

The mobile flow: tapping the channel name in the header opens the bottom sheet channel list.

### Task 4.3 — Mobile-optimize ChannelInfo

**File:** `src/components/chat/ChannelInfo.tsx`

Wrap the right sidebar content in a bottom drawer variant:
- Extract the info content into a reusable inner component
- Desktop: keep as `Box` right sidebar (existing)
- Mobile: render inside a Chakra `Drawer placement="bottom"`
- Add a `placement` prop: `'desktop' | 'mobile'`
- Tapping member count / info icon in header opens this sheet on mobile

### Task 4.4 — Mobile-optimize ChannelCreateModal

**File:** `src/components/chat/ChannelCreateModal.tsx`

On mobile (`< lg`):
- Use full-screen `Modal` with `size="full"` instead of the default `Modal`
- Back arrow in header instead of close button
- Form fields stack vertically (already happening)
- Larger touch targets on form elements

---

## Phase 5 — Gesture Interactions

### Task 5.1 — Swipeable channel navigation

**File:** `src/components/chat/MessageList.tsx` and/or `src/app/(app)/chat/page.tsx`

Add swipe gesture handlers using framer-motion's `useDragControls` or a `motion.div` with `drag="x"` and `onDragEnd`:

```tsx
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.1}
  onDragEnd={(_, info) => {
    const SWIPE_THRESHOLD = 80;
    if (info.offset.x > SWIPE_THRESHOLD) switchToPreviousChannel();
    if (info.offset.x < -SWIPE_THRESHOLD) switchToNextChannel();
  }}
>
```

Behavior:
- Swipe left → next channel in the list
- Swipe right → previous channel
- Only active on mobile (`< lg`)
- Visual: slight horizontal translation during drag (rubber-band effect)
- Haptic feedback on successful swipe via Capacitor Haptics (`@capacitor/haptics`)

Implementation:
- Add `channels` and `activeChannelId` props to `MessageList` (or handle at page level)
- Actually better to wrap at the page level (chat/page.tsx) around the entire chat area, not inside MessageList
- Use `useRef` + `useCallback` for channel index tracking

### Task 5.2 — Pull-to-refresh on message list

**File:** `src/components/chat/MessageList.tsx`

Add a pull-to-refresh gesture:
- Use a `motion.div` wrapper with `drag="y"` and `dragDirectionLock`
- When pulled down past threshold (80px), trigger `onRefresh` callback
- Show a loading spinner or "Release to refresh" indicator during pull
- Animate back on release

Add optional `onRefresh` prop:
```tsx
interface MessageListProps {
  // ...existing props
  onRefresh?: () => Promise<void>;
}
```

Only active on mobile. Disable when already loading.

### Task 5.3 — Capacitor Haptics integration

**File:** `src/lib/haptics.ts` (new)

Helper for haptic feedback:
```typescript
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const lightHaptic = () => Haptics.impact({ style: ImpactStyle.Light });
export const mediumHaptic = () => Haptics.impact({ style: ImpactStyle.Medium });
export const heavyHaptic = () => Haptics.impact({ style: ImpactStyle.Heavy });
```

These are safe to call on non-native (web) — Capacitor stubs them.

Integrate:
- Channel swipe: `mediumHaptic()`
- Long-press to open action sheet: `lightHaptic()`
- Send message: `lightHaptic()`

---

## Phase 6 — Mobile Input & Bottom Sheets

### Task 6.1 — Move emoji picker to bottom sheet

**File:** `src/components/chat/ChatInput.tsx`

Replace the floating `EmojiPicker` (positioned absolutely above input) with a bottom drawer variant on mobile:
```tsx
<Drawer placement="bottom" isOpen={showEmoji} onClose={() => setShowEmoji(false)}>
  <DrawerContent borderTopRadius="2xl" h="40dvh">
    <EmojiPicker onSelect={...} onClose={...} />
  </DrawerContent>
</Drawer>
```

Keep floating variant on desktop.

### Task 6.2 — Move GIF picker to bottom sheet

**File:** `src/components/chat/GifPicker.tsx`

Currently a `Modal`. On mobile, render as a `Drawer` with `placement="bottom"` and `size="full"`:
```tsx
// Inside GifPicker, check if mobile
const isMobile = useBreakpointValue({ base: true, lg: false });
if (isMobile) {
  return <Drawer placement="bottom" isOpen={isOpen} onClose={onClose} size="full">...</Drawer>;
}
return <Modal isOpen={isOpen} onClose={onClose}>...</Modal>;
```

### Task 6.3 — Expandable chat input for mobile

**File:** `src/components/chat/ChatInput.tsx`

On mobile:
- Change `Input` to `Textarea` (single line initially, expands to 4 lines max)
- Auto-resize via `onInput` handler adjusting height
- Remove the formatting toolbar row on mobile (keep emoji, GIF, poll, attachment as icon-only buttons in a compact row between input and send button)
- Add `@mention` button and `📎 attachment` button to the compact toolbar

---

## Phase 7 — Polish & Edge Cases

### Task 7.1 — Safe area audit

Ensure all new bottom sheets and drawers use `sx={{ paddingBottom: 'env(safe-area-inset-bottom)' }}` and `paddingTop: 'env(safe-area-inset-top)'` where appropriate. Match the existing pattern in `DemoShell` and `BottomNav`.

### Task 7.2 — Touch target audit

Verify all interactive elements have minimum 44x44px touch targets on mobile:
- Channel pills: min 44px height
- Bottom sheet rows: min 48px height
- Action sheet items: min 48px height
- Send button: already 48x48px ✓
- Input field: already 48px height ✓

### Task 7.3 — Keyboard avoidance

The Capacitor Keyboard plugin already sets `--keyboard-height` CSS variable. Ensure:
- Chat input container uses the CSS var for bottom padding when keyboard is open
- Message list scrolls to bottom when keyboard opens
- Bottom sheets dismiss when keyboard opens (keyboard + bottom sheet = bad UX)

### Task 7.4 — Empty states

- No channels: show "Create your first channel" with CTA
- No messages: show "No messages yet" with illustration (existing, in `MessageList`)
- Channel not found: show "Channel not found" with back-to-general button

---

## Execution Order

| Step | Task | Files | Dependencies |
|------|------|-------|--------------|
| 1 | Fix `ChatMessage` type | `types.ts` | None |
| 2 | Fix demo seed data | `demo/data.ts` | Task 1 |
| 3 | Fix demo `createChatMessage` | `demo/context.tsx` | Task 1 |
| 4 | Create barrel export | `components/chat/index.ts` | None |
| 5 | Create `ChannelPillBar` | `components/chat/ChannelPillBar.tsx` | None |
| 6 | Create `ChannelBottomSheet` | `components/chat/ChannelBottomSheet.tsx` | None |
| 7 | Create `MessageActionSheet` | `components/chat/MessageActionSheet.tsx` | None |
| 8 | Update `MessageBubble` for mobile | `components/chat/MessageBubble.tsx` | Task 7 |
| 9 | Refactor demo chat page | `demo/chat/page.tsx` | Tasks 1-8 |
| 10 | Add `createChannel` to demo context | `demo/context.tsx` | Task 9 |
| 11 | Add pill bar + bottom sheet to real chat | `(app)/chat/page.tsx` | Tasks 5, 6 |
| 12 | Mobile-optimize ChannelInfo | `components/chat/ChannelInfo.tsx` | Task 11 |
| 13 | Mobile-optimize ChannelCreateModal | `components/chat/ChannelCreateModal.tsx` | None |
| 14 | Swipe gesture for channels | `(app)/chat/page.tsx` + `MessageList.tsx` | Task 11 |
| 15 | Pull-to-refresh | `MessageList.tsx` | None |
| 16 | Haptics helper | `lib/haptics.ts` | Task 14 |
| 17 | Emoji/GIF bottom sheet | `ChatInput.tsx`, `GifPicker.tsx` | None |
| 18 | Expandable input | `ChatInput.tsx` | None |
| 19 | Polish (safe areas, touch targets, keyboard) | various | All above |

---

## Files to Create
- `src/components/chat/index.ts`
- `src/components/chat/ChannelPillBar.tsx`
- `src/components/chat/ChannelBottomSheet.tsx`
- `src/components/chat/MessageActionSheet.tsx`
- `src/lib/haptics.ts`

## Files to Modify
- `src/lib/types.ts` — add `channel_id` to `ChatMessage`
- `src/lib/demo/data.ts` — add `channel_id` to seed messages
- `src/lib/demo/context.tsx` — update `createChatMessage`, add `createChannel`
- `src/app/demo/chat/page.tsx` — full rewrite to use shared components
- `src/app/(app)/chat/page.tsx` — add pill bar, bottom sheet, swipe gesture
- `src/components/chat/MessageBubble.tsx` — long-press action sheet
- `src/components/chat/MessageList.tsx` — pull-to-refresh, swipe props
- `src/components/chat/ChatInput.tsx` — expandable input, bottom sheets
- `src/components/chat/GifPicker.tsx` — mobile bottom sheet variant
- `src/components/chat/ChannelInfo.tsx` — mobile bottom sheet variant
- `src/components/chat/ChannelCreateModal.tsx` — full-screen on mobile

## Validation

1. **Build:** `npm run build` must succeed (no type errors)
2. **Demo chat:** Multi-channel navigation works, messages appear per channel, long-press shows actions
3. **Real chat:** Same behavior, plus real-time messages continue working
4. **Mobile layout:** Bottom nav, pill bar, channel sheet, input all visible and tappable at 375px viewport
5. **Desktop:** No regressions — left sidebar, hamburger drawer, right info panel unchanged
6. **Gesture:** Swipe left/right switches channels without conflict with scrollable message list
