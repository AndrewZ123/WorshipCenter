# Chat Scroll: useLayoutEffect + remove rAF

## Problem

Chat opens at bottom briefly, then jumps to a random position (the
"flash-to-bottom-then-flash-to-middle" bug). Debugging has been ongoing
for hours across multiple approaches.

## Root Causes

### Cause 1: `useEffect` + `requestAnimationFrame` = two-frame delay

`useEffect` fires **after** the browser paints the committed DOM. The
`requestAnimationFrame` inside it adds another frame of delay because
`useEffect` is "post-paint" and rAF is "pre-next-paint."

Sequence on every render:

```
DOM commit → paint (wrong scroll position) → useEffect fires
    → rAF scheduled → next paint (rAF still hasn't run)
    → rAF runs: scrollIntoView → paint again (correct scroll)
```

The user sees two frames of wrong position before the scroll takes effect.

### Cause 2: Keyboard hide resizes WebView, clamping scrollTop

`ChatInput.tsx` calls `Keyboard.hide()` on mount (async dynamic import).
By the time it resolves, the scroll has already run. The keyboard hide
increases `clientHeight` by 345px, which causes the browser to clamp
`scrollTop` to `scrollHeight - clientHeight_new`. Content shifts up by
345px — the "jump" away from bottom.

With `useEffect` + `rAF`, the keyboard resize can race ahead of the
re-scroll, because `useEffect` fires post-paint and rAF waits another
frame.

### Cause 3: `requestAnimationFrame` is redundant inside rAF

There is no case where `requestAnimationFrame` helps here:
- `useEffect` already runs post-paint, so rAF doesn't help "wait for DOM"
- `useLayoutEffect` runs pre-paint, so rAF just delays the scroll for
  no reason

## Fix: `useLayoutEffect` + remove `requestAnimationFrame`

Replace `useEffect` with `useLayoutEffect` for the auto-scroll effect,
and remove the `requestAnimationFrame` wrapper so `scrollToBottom` is
called synchronously.

New sequence:

```
DOM commit → useLayoutEffect runs: scrollIntoView → paint (correct!)
```

The scroll position is set before the first paint, so the user never
sees a flash of the wrong position. The keyboard-hide resize listener
also benefits — it runs immediately rather than waiting for rAF.

## Files to Change

### `src/components/chat/MessageList.tsx`

1. **Import**: add `useLayoutEffect` alongside the existing `useEffect`
   import (keep `useEffect` for the scroll-event listener and resize
   listener — those are side effects, not layout effects).

2. **Auto-scroll effect (line 92):** Change `useEffect` to
   `useLayoutEffect` and remove the `requestAnimationFrame` wrapper:

   ```tsx
   useLayoutEffect(() => {
     if (messages.length === 0) return;
     if (isLoading) return;
     if (messages === prevMessagesRef.current) return;
     if (!atBottomRef.current) return;

     const behavior = isInitialLoadRef.current ? 'auto' : 'smooth';
     isInitialLoadRef.current = false;
     prevMessagesRef.current = messages;

     scrollToBottom(behavior);
   }, [messages, isLoading, scrollToBottom]);
   ```

3. **Resize listener (line 116):** Keep as `useEffect` but remove the
   `requestAnimationFrame` wrapper — the callback runs synchronously
   when the resize event fires, before the next paint:

   ```tsx
   useEffect(() => {
     const onResize = () => {
       if (atBottomRef.current) {
         scrollToBottom('auto');
       }
     };
     window.addEventListener('resize', onResize);
     return () => window.removeEventListener('resize', onResize);
   }, [scrollToBottom]);
   ```

4. **Scroll event listener (line 106):** Keep as `useEffect` unchanged —
   event listener registration is a side effect, no layout needed.

## Rationale

`useLayoutEffect` fires synchronously after DOM mutations but before
the browser paints. This guarantees `scrollIntoView` runs before the
user sees anything. The `requestAnimationFrame` wrapper was actually
making things worse by deferring the scroll past the point where paint
was already scheduled.

The keyboard resize (`clientHeight` changing when `Keyboard.hide()`
runs) gets corrected in the same synchronous pass, preventing the
"clamped scrollTop" from ever being painted.

## Validation

1. Open a channel with 50+ messages → should land at bottom on first
   paint, no flash
2. Switch channels → no flash, immediate correct position
3. Send a message → auto-scroll, no delay
4. Receive subscription message at bottom → auto-scroll, no flash
5. Scroll up → new messages don't yank position
6. Keyboard show/hide → scroll stays at bottom
