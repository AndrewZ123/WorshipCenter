# Chat Scroll Rebuild

## Problem

Opening a chat channel scrolls to the middle of the message list instead of the
absolute bottom (newest message). Multiple incremental fixes have failed; a
rebuild of the scrolling logic is needed.

### Current symptoms

1. Chat opens at middle of message list (not bottom)
2. After some changes: flashes to bottom briefly, then jumps back to middle
3. Scrolling is sometimes unresponsive for ~1s after load

## Root causes identified

### Cause 1: Three separate renders during channel load

`chat/page.tsx loadMessages()` issues three sequential state updates:

```
setMessages(msgs)           → render A (messages in DOM, isLoading still true)
setReactions(grouped)       → render B (reactions added, isLoading still true)
setIsLoadingMessages(false) → render C (loading clears, final state)
```

Each is a separate microtask (separated by `await`), so React 18 does NOT batch
them. The `isLoading` guard in `showSpinner` prevents visual flashes, but the
DOM changes behind the scenes and scroll effects can fire on render A before
reactions are loaded.

### Cause 2: No `isLoading` guard on `prevLenRef` effect

The `prevLenRef` auto-scroll effect (`MessageList.tsx:99-106`) does NOT check
`isLoading`. When the subscription delivers messages during the loading phase
(render A→C gap), or when `setMessages(msgs)` changes `messages.length`, the
effect can fire and scroll to a position that does not yet include reaction UI.

### Cause 3: `atBottomRef` initialised to `true`

`atBottomRef` starts as `true`, so scroll-guard logic can fire before any user
scroll has happened. If `prevLenRef.current > 0` is also true (e.g. switching
from a channel that had messages), a scroll fires immediately on `setMessages`
even though the user has never scrolled in the new channel.

### Cause 4: Dynamic `import('@/lib/supabase')` adds latency

Every channel switch triggers `await import('@/lib/supabase')` inside
`loadMessages` (line 95). This adds 100-500ms of network delay between
`setMessages` and `setIsLoadingMessages(false)`, widening the window for
subscription messages to arrive mid-load.

### Cause 5: `groups` reference changes on every `messages` mutation

`useMemo` with `[messages]` as dep creates a new `groups` array on every
`setMessages` call. Since `AnimatePresence` uses referential identity to track
entering/exiting children, each new `groups` reference causes it to detect
all groups as "new" → re-entering, potentially triggering animation hooks that
affect layout.

### Cause 6: framer-motion `motion.div` in `MessageBubble`

Each MessageBubble has `initial={{ opacity: 0, y: 10, scale: 0.98 }}` →
`animate={{ opacity: 1, y: 0, scale: 1 }}` over 0.2s. While CSS transforms
don't affect layout, framer-motion's internal scheduling can cause React
re-renders during animation. With 50+ messages animating simultaneously, the
browser's main thread can become saturated, delaying scroll responses.

## Solution: Rebuild scrolling logic using proven ServiceChat pattern

The `ServiceChat.tsx` component (`src/components/services/ServiceChat.tsx`,
lines 238-310) has a scroll implementation that works correctly. Replicate its
approach in `MessageList.tsx`.

### Concrete changes

#### 1. `MessageList.tsx` — Replace scroll effects

Replace the current three effects with the ServiceChat pattern:

**`scrollToBottom` (was line 77-83):**
```tsx
const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
  const el = containerRef.current;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior });
  atBottomRef.current = true;
}, []);
```

Uses `scrollTo()` (the standard scrolling method) instead of `scrollTop = scrollHeight`.
Accepts a `behavior` parameter for instant vs smooth scrolling.

**Remove `prevLenRef` entirely** — not needed. The ServiceChat doesn't use it.

**Replace with a single auto-scroll effect:**
```tsx
const isInitialLoadRef = useRef(true);
const prevMessagesRef = useRef<any[]>([]);

useEffect(() => {
  if (messages.length === 0) return;
  if (isLoading) return;                     // ← critical guard
  if (messages === prevMessagesRef.current) return; // skip if same reference

  const behavior = isInitialLoadRef.current ? 'auto' : 'smooth';
  isInitialLoadRef.current = false;
  prevMessagesRef.current = messages;

  requestAnimationFrame(() => scrollToBottom(behavior));
}, [messages, isLoading, scrollToBottom]);
```

Key differences from current code:
- Guards on `isLoading` — no scrolls during loading phase
- Tracks `isInitialLoadRef` for instant first scroll vs smooth subsequent scrolls
- Uses reference equality on `messages` array to avoid duplicate scrolls
- Depends on `[messages]` (full array) instead of `messages.length`

**Keep** the scroll event listener (for `atBottomRef`) unchanged.

**Fix `showSpinner` / `showEmpty` / `showMessages` conditions:**

```tsx
const showSpinner = isLoading;
const showLoaded = !isLoading;
const showEmpty = showLoaded && messages.length === 0;
const showMessages = showLoaded && messages.length > 0;
```

This ensures messages only render when `isLoading` is false AND they exist.

**Also fix:** Add `position="relative"` to the container if not already present
(required for the loading overlay to overlay correctly).

#### 2. `chat/page.tsx` — Remove dynamic import latency

Move the supabase import from dynamic to static to eliminate the 100-500ms
delay between `setMessages` and `setIsLoadingMessages(false)`.

**Before (line 95):**
```tsx
const { data: reactionData } = await (await import('@/lib/supabase')).supabase
```

**After:**
```tsx
import { supabase } from '@/lib/supabase';  // top-level static import
// ...
const { data: reactionData } = await supabase
```

This compresses the `setMessages` → `setIsLoadingMessages(false)` window,
reducing the chance of subscription messages arriving mid-load.

#### 3. `MessageBubble.tsx` — Remove initial mount animation

The `motion.div` animation plays on every mount, including the initial batch
load of 50+ messages. While CSS transforms don't change layout, they cause
internal framer-motion scheduling work that contributes to main-thread
saturation.

**Change to:**
```tsx
<motion.div
  initial={false}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 0.2 }}
>
```

With `initial={false}`, the component skips the entrance animation and appears
immediately at the `animate` state. Future `AnimatePresence`-controlled
entrances (e.g. real-time new messages) will still animate because
`AnimatePresence` overrides `initial`.

#### 4. `MarkdownRenderer.tsx` — Remove `loading="lazy"` on initial-load images

The `loading="lazy"` attribute defers image loading until the image is near the
viewport. After `scrollToBottom()` scrolls to the bottom, the bottom images
start loading asynchronously. Each loaded image triggers a browser repaint
that can shift scroll timing.

Change to:
```tsx
<img src={part.url} alt=""
  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
/>
```

Remove `loading="lazy"` so images load immediately regardless of viewport
position. The 160px fixed container ensures no layout shift when images load.

## Risk / trade-offs

| Change | Risk | Mitigation |
|---|---|---|
| Removing `loading="lazy"` | More network requests on page load | Images are already capped at 160px height; total data impact is small for a chat app |
| Removing `prevLenRef` effect | New messages from subscription won't auto-scroll | Replaced by the new `[messages]`-based effect which checks `isInitialLoadRef` — first load is instant, subsequent subscription messages are smooth |
| Static supabase import | Slightly larger initial bundle | The supabase client is likely already imported elsewhere; dynamic import was likely premature optimization |
| Removing MessageBubble entrance animation | Messages won't "animate in" on initial load | Still animate in when added via real-time subscription (AnimatePresence handles new children) |
| `isLoading` guard on scroll | First scroll might be delayed if isLoading doesn't clear properly | The parent always clears `isLoadingMessages` in `finally`; if it doesn't clear, that's a bug in the parent, not the scroll logic |

## Validation

1. Open a channel with 50+ messages → scroll should land at absolute bottom
2. Switch to another channel → scroll should land at that channel's bottom
3. Send a new message → should auto-scroll smoothly
4. Receive a real-time message while at bottom → should auto-scroll smoothly
5. Scroll up to read history → new messages should NOT steal scroll position
6. Open a channel with images in messages → images load, scroll stays at bottom
7. Test on iOS Safari (iPhone) → keyboard open/close doesn't shift scroll
