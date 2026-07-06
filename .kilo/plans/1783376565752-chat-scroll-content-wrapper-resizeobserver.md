# Chat Scroll + Keyboard Prevention

## Status

**Scroll fix (content wrapper + dual ResizeObserver) is working.** Images/GIFs loading no longer cause scroll flash.

**Keyboard prevention approaches that have failed:**

1. `blur()` in `useEffect` — too late (after paint, keyboard already visible)
2. `disabled` attribute on mount — WKWebView bypasses HTML `disabled` at native layer
3. `Keyboard.hide()` in `useLayoutEffect` — creates show→hide→show cycle, locks scroll
4. `visibility: hidden` on mount — WKWebView detects `<input>` presence in DOM regardless of CSS

## Root Cause

WKWebView keyboard session restoration detects `<input>` elements in the DOM tree at the **native/WKWebView level**, not through CSS or HTML focus mechanisms. It searches for form inputs during page load and if it finds any, it tries to restore the keyboard session from the previous navigation — regardless of `disabled`, `visibility`, `tabIndex`, or `pointer-events`.

**The only reliable prevention**: Don't render any `<input>` element during the WKWebView restoration window.

## Fix: Conditional Input Rendering

Replace the `<Input>` element with a placeholder `<Box>` on the first commit. After `useLayoutEffect` fires (before paint), mount the real `<Input>`. WKWebView searches the DOM during page load — with no `<input>` element present, it finds nothing to restore, and the keyboard stays hidden.

### Sequence

```
1. React commits: placeholder <Box> in DOM, no <input> element exists
2. WKWebView searches for form inputs → finds NONE → skips keyboard restoration
3. useLayoutEffect fires: setInputReady(true) → synchronous re-render
4. Second commit (before paint): <Box> unmounts, <Input> mounts
5. Paint: user sees Input, no keyboard
```

## Files to Change

### `src/components/chat/ChatInput.tsx`

**1.** Replace the `inputReady` + `visibility` wrapper with a conditional:

```tsx
{inputReady ? (
  <Input
    ref={inputRef}
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyDown={handleKeyDown}
    placeholder="Type a message..."
    size="md"
    h={isMobile ? '44px' : '48px'}
    fontSize={isMobile ? '16px' : 'md'}
    bg={inputBg}
    border="1px solid"
    borderColor={inputBorder}
    borderRadius="xl"
    pr="12"
    _placeholder={{ color: 'gray.400' }}
    _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.15)' }}
    disabled={isSending}
  />
) : (
  <Box
    h={isMobile ? '44px' : '48px'}
    w="full"
    bg={inputBg}
    border="1px solid"
    borderColor={inputBorder}
    borderRadius="xl"
  />
)}
```

The placeholder `<Box>` has the same dimensions and visual style as the `<Input>`, so the flex parent maintains its layout during both commits. The emoji `IconButton` (positioned absolute inside the same parent `Box`) remains visible and functional.

**2.** Remove the `<Box visibility={...}>` wrapper that was added in the previous attempt.

### `src/components/chat/MessageList.tsx`

No changes needed. The content wrapper + ResizeObserver fix stays as-is.

## Why the Placeholder Approach Works

Previous approaches failed because WKWebView detected the `<input>` element through native DOM inspection:

| Approach | Why WKWebView Still Found the Input |
|---|---|
| `disabled` | Native layer ignores HTML `disabled` for session restoration |
| `Keyboard.hide()` | Cancels animation but WKWebView re-requests immediately |
| `visibility: hidden` | Element still exists in DOM tree, WKWebView finds it |
| **No `<input>` in DOM** | **Nothing to detect — no restoration possible** |

## Validation

1. Navigate to chat page → keyboard does NOT open
2. Tap the input → keyboard opens normally
3. Send a message → keyboard behavior unaffected
4. Navigate away from chat, come back → keyboard still does NOT open
5. Swipe between channels → keyboard does NOT open on any channel
6. Console shows no `[ChatScroll]` container-resize events on mount (confirm no keyboard-triggered CSS changes)

## Edge Cases

- **Input never appears**: If `inputReady` never becomes true (catastrophic error), the placeholder stays and the user sees a non-interactive input area. This is an acceptable failure state (the app is already broken).
- **Timing of setInputReady**: The effect runs during `useLayoutEffect` which fires synchronously after the first commit. The second commit (with the real Input) happens before paint, so the user never sees the placeholder.
- **Input ref**: `inputRef.current` is `null` during the first commit. The `useLayoutEffect` doesn't access it, so this is fine. After the second commit, `inputRef.current` points to the real Input.
- **Channel navigation (route-level)**: Each navigation creates a new chat page component mount. The Input is not in the DOM during the initial commit of each navigation. Works correctly.
- **Channel switching (in-page)**: The parent page's state changes trigger a re-render of ChatInput. The component doesn't remount, so `inputReady` stays `true` and the Input remains rendered. No change needed.
