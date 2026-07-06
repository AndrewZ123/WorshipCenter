# Chat Scroll: Content Wrapper ResizeObserver

## Problem

The "flash to bottom then jump to middle" bug persists. Two independent root causes:

### Cause A: Keyboard show/hide → container resizes (iOS Capacitor)

`keyboardWillShow` fires on mount via WKWebView session restoration. With `resize: none`, this adds `body.keyboard-visible`, shrinking `.shell-root` by 345px. The container's `clientHeight` drops by 345px, `scrollTop` is clamped to `scrollHeight - clientHeight_new`, and the user jumps off-bottom.

Previous fix: `ResizeObserver` on the container, set up in `useLayoutEffect` (already applied). This catches container size changes **if the observer is registered before the event arrives**.

### Cause B: Async image/GIF loading → `scrollHeight` grows → sentinel moves down

**This is the cause that was missed.** When the last message contains a GIF or image:
1. `<img>` renders at 0px height (image hasn't loaded yet)
2. `useLayoutEffect` → `scrollIntoView(sentinel)` → correct position for zero-height image
3. Image loads, takes up height → `scrollHeight` grows → sentinel physically moves down
4. `scrollTop` stays the same (browser does not auto-scroll for image load)
5. User appears to jump off-bottom

The existing `ResizeObserver` on the **container** does NOT fire here. The container's own content box (`clientHeight`) doesn't change — it's a flex child with a fixed height determined by its parent. Only the scrollable content (`scrollHeight`) grows.

## Fix: Content Wrapper + Dual-Element ResizeObserver

Add a content wrapper `<Box>` inside the container that wraps the message list and sentinel. Observe the wrapper's height with `ResizeObserver` — when images load and the wrapper grows, the observer fires, and we re-scroll.

## Files to Change

### `src/components/chat/MessageList.tsx`

**1. Add `contentWrapperRef`** — a `useRef<HTMLDivElement>(null)` alongside the existing refs.

**2. Replace the existing single-element ResizeObserver `useLayoutEffect`** (lines 113-129) with a dual-element version that observes both `containerRef.current` and `contentWrapperRef.current`:

```tsx
useLayoutEffect(() => {
  const container = containerRef.current;
  const wrapper = contentWrapperRef.current;
  if (!container || !wrapper) return;

  const observer = new ResizeObserver(() => {
    if (atBottomRef.current) {
      scrollToBottom('auto');
    }
  });

  observer.observe(container);
  observer.observe(wrapper);

  return () => observer.disconnect();
}, [scrollToBottom]);
```

This catches:
- Container size changes (keyboard show/hide via CSS on `.shell-root`)
- Content height changes (image/GIF/poll loading)

**3. Wrap messages + sentinel in `<Box ref={contentWrapperRef}>`**:

```tsx
<Box ref={containerRef} flex="1" overflowY="auto" p={{ base: '4', md: '6' }} bg={bgColor} position="relative">
  {/* Loading overlay — keep container alive */}
  {showSpinner && (...)}

  {/* Empty state */}
  {showEmpty && (...)}

  {/* Messages */}
  {showMessages && (
    <Box ref={contentWrapperRef}>
      <AnimatePresence initial={false}>
        ...
      </AnimatePresence>
      <div ref={bottomRef} />
    </Box>
  )}

  {/* When not showing messages, still render a wrapper for the observer */}
  {!showMessages && !showSpinner && !showEmpty && (
    <Box ref={contentWrapperRef}>
      <div ref={bottomRef} />
    </Box>
  )}
</Box>
```

**4. Add debug logging** — log container dimensions on every resize observer fire, scroll event, and auto-scroll:

```
[ChatScroll] auto-scroll: <behavior> scrollH=<h> clientH=<h> scrollT=<t>
[ChatScroll] ResizeObserver: scrollH=<h> clientH=<h> scrollT=<t> atBottom=<bool>
[ChatScroll] handleScroll: scrollT=<t> clientH=<h> scrollH=<h> atBottom=<bool>
```

Concatenate multiple logs on one line (e.g. `"scrollH=${sh} clientH=${ch} scrollT=${st} atBottom=${ab}"`) to make them greppable.

### `src/components/chat/ChatInput.tsx`

No changes — `inputRef.current?.blur()` instead of `Keyboard.hide()` is already applied.

## Validation

1. Open a channel where the last message is a GIF → lands at bottom on first paint, no flash
2. Switch channels → immediate correct position, no flash
3. Send a message → auto-scrolls without visible delay
4. Receive subscription message at bottom → auto-scrolls
5. Scroll up → new messages don't yank position
6. Keyboard show/hide (iOS) → scroll stays at bottom
7. Console shows `[ChatScroll]` logs with expected values; no duplicate or racing scrolls

## Edge Cases

- **Zero messages**: Content wrapper renders with only the sentinel div. Height is 0px (or sentinel height). `ResizeObserver` fires when messages first appear and wrapper grows.
- **First load with no images**: Wrapper height determined by text content. `ResizeObserver` fires once during commit, at which point `scrollToBottom` runs. No issue.
- **Images with explicit dimensions**: `<img height="..." width="...">` don't cause layout shift — they start at the correct height. `ResizeObserver` fires early but `scrollToBottom` is idempotent.
- **Channel switch**: The old wrapper unmounts (resize observer on old element disconnects automatically), new wrapper mounts, new observer is set up in `useLayoutEffect`.
- **Rapid keyboard toggle**: `ResizeObserver` fires for each resize. `scrollToBottom` is called each time but scrollIntoView is idempotent when already at bottom.
- **Flex layout settling**: Content wrapper might resize multiple times during initial layout. Each resize fires the observer. Since `atBottomRef.current` is `true` during initial load, `scrollToBottom` runs each time, keeping the sentinel visible.

## Risks

- **Performance**: Two observed elements + callback on every resize. `ResizeObserver` is batched and runs before paint, so this is efficient. No layout thrashing from synchronous `scrollIntoView` because the browser coalesces scroll assignments within the same frame.
- **Re-render without messages change**: The content wrapper's `ref` assignment happens only when the condition branch changes (show/hide messages). React's `ref` callback only fires on mount/unmount of the conditional branch, not on every render. So the observer isn't recreated on every render.
- **Loading spinner with messages in background**: The loading overlay uses `position: absolute; inset: 0` inside the container, not inside the content wrapper. It doesn't affect the wrapper's height.
