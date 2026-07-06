# Chat Feature — Comprehensive Audit & Fix Plan

## Primary Strategy: ClientOnly Wrapper

Wrap the chat page in a `ClientOnly` component that renders `null` during SSR. This eliminates ALL hydration errors (#418, #310) at once because:
- The root layout at `src/app/(app)/layout.tsx` is already `'use client'` with no SSR auth
- Chat is a realtime feature with no SEO value
- Every conditional render (`isOwn`, `isAdmin`, `isCreator`, timestamps) becomes safe
- Chakra CSS class mismatches from `isOwn ? A : B` style props are eliminated
- No more individual surgical fixes needed

## Implementation Checklist

### Phase 1: Fix Hydration Errors (HIGH PRIORITY)

- [ ] **1a. Create `src/components/ui/ClientOnly.tsx`**
  - Renders `null` during SSR, `children` after mount
  - Uses `useState(false)` + `useEffect(() => setMounted(true), [])`
  
- [ ] **1b. Wrap production chat page content**
  - In `src/app/(app)/chat/page.tsx`, wrap the entire JSX return in `<ClientOnly>`
  - Show a `Spinner` as fallback while not mounted
  
- [ ] **1c. Wrap demo chat page content**
  - Same pattern in `src/app/demo/chat/page.tsx`

- [ ] **1d. Strip out dead hydration-fix code**
  - Remove the `useEffect` hover listeners from `MessageBubble.tsx` (no longer needed — `_groupHover` won't cause errors inside ClientOnly)
  - Restore clean `_groupHover={{ opacity: 1 }}` in both production and demo MessageBubble
  - Remove `menuRef` and `rowRef` hover-effect useEffects

### Phase 2: Fix Scroll-To-Bottom (HIGH PRIORITY)

- [ ] **2a. Rewrite scroll logic in `MessageList.tsx`**
  - On initial messages load: immediately `scrollTop = scrollHeight`
  - Register ResizeObserver on container
  - When container grows AND user hasn't scrolled up: scroll to bottom
  - 200ms debounce on ResizeObserver to avoid rapid re-scrolls
  - For NEW messages (vs initial load): always scroll to bottom regardless of user position

- [ ] **2b. Track user scroll position**
  - Add scroll event listener to container
  - Set `atBottomRef.current` when `scrollTop + clientHeight >= scrollHeight - 60`
  - Use this to gate auto-scroll for async content changes, NOT for initial load

### Phase 3: Poll System Fixes (MEDIUM PRIORITY)

- [ ] **3a. PollRenderer: prevent option editing when votes exist**
  - In edit mode, disable option text inputs if `totalVotes > 0`
  - Show a text note: "Options can't be edited after votes are cast"

- [ ] **3b. PollRenderer: reset edit form on cancel**
  - Reset `editQuestion` and `editOptions` to current poll values when cancelling

### Phase 4: Channel Management Fixes (MEDIUM PRIORITY)

- [ ] **4a. ChannelInfo: reset edit modal form on open**
  - Use `key={channel.id}` on the modal, or reset state in the modal-open handler

- [ ] **4b. ChannelInfo: fix double closeDelete call**
  - Remove the extra `setDeleteOpen(false)` in `handleDelete` (ConfirmDialog already calls `onClose`)

- [ ] **4c. Better channel selection after deletion**
  - In chat page `onDeleteChannel`, select the neighboring channel by index instead of first remaining

### Phase 5: Message Editing Polish (LOW PRIORITY)

- [ ] **5a. Keyboard shortcut for save**
  - Add Ctrl+Enter / Cmd+Enter handler in edit mode

- [ ] **5b. Error toasts for failed save/delete**
  - In `handleEdit`/`handleDelete` callbacks, catch errors and show toast

### Phase 6: Edge Cases (LOW PRIORITY)

- [ ] **6a. Subscription channel-id guard**
  - In chat page realtime subscription callback, check `payload.channel_id === activeChannel.id` before applying

## Files Modified

| File | Changes |
|------|---------|
| `src/components/ui/ClientOnly.tsx` | **NEW** — client-only render gate |
| `src/app/(app)/chat/page.tsx` | Wrap in ClientOnly; fix channel deletion logic |
| `src/app/demo/chat/page.tsx` | Wrap in ClientOnly; restore clean `_groupHover` |
| `src/components/chat/MessageBubble.tsx` | Remove DOM hover-effect useEffects; restore `_groupHover` |
| `src/components/chat/MessageList.tsx` | Rewrite scroll logic with ResizeObserver |
| `src/components/chat/PollRenderer.tsx` | Guard option editing against votes; reset on cancel |
| `src/components/chat/ChannelInfo.tsx` | Reset edit modal on open; fix delete flow |

## Validation

1. `npm run build` — no TypeScript errors
2. `npm run lint` — no new warnings
3. Open production chat page → no hydration errors (418, 310)
4. Scroll to bottom works on initial load with polls
5. Edit/delete messages works
6. Close/edit polls works
7. Edit/delete channels (admin) works
8. Demo chat page also works without errors
