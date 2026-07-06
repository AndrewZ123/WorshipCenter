# Chat Keyboard Auto-Show: Ground-Up Rebuild Plan

## Root Cause

iOS WKWebView has internal heuristics that detect text-receiving DOM elements (`<input>`, `<textarea>`) and auto-focuses them after page load — regardless of `disabled` or other attributes. This is NOT caused by any JS `.focus()` call or Capacitor plugin. The Capacitor `keyboardWillShow` event is a *consequence* of the keyboard appearing, not the *cause*.

All previous workarounds (placeholder Box swap, `disabled` attribute) fail because the `CAP-ACITOR WebView eventually detects the `<input>` element and triggers the keyboard.

## Attack Surface

| Location | Element | Risk |
|---|---|---|
| `ChatInput.tsx` | `<Input>` (Chakra) mounted from first render | WKWebView auto-focuses on load |
| `ServiceChat.tsx` | `<Textarea>` always mounted | Same WKWebView heuristics apply |
| `MessageBubble.tsx:238` | `<Textarea autoFocus>` | Auto-focuses on edit mode mount |
| `ChannelBottomSheet.tsx:116` | `<Input autoFocus>` | Auto-focuses on sheet open |
| `GifPicker.tsx:74,162` | `<Input autoFocus>` | Auto-focuses on GIF picker open |
| `ClientOnly.tsx` | Double-render via `useEffect` | Resets focus state mid-load |

## Strategy

Replace ALL `<input>` and `<textarea>` elements with `<div contentEditable>` (or `contentEditable="plaintext-only"`). `contentEditable` divs are NOT auto-focused by WKWebView — they're treated as regular content, not form controls. This is the pattern used by WhatsApp Web, Telegram Web, and many other production chat apps.

If this approach still fails (iOS 18+ could change behavior), the fallback is to render a non-focusable "Tap to compose" button on initial load and swap to a real input only on user tap.

For `autoFocus` props: replace with `useEffect` + `requestAnimationFrame` so focus is deferred past the initial render cycle when WKWebView is scanning for inputs.

## Implementation Tasks

### Task 1: Rewrite ChatInput (`src/components/chat/ChatInput.tsx`)

Replace the Chakra `<Input>` with a `contentEditable` div. Preserve all existing features.

**New component structure:**
```tsx
// State
const [input, setInput] = useState('');
const inputRef = useRef<HTMLDivElement>(null);

// No more: inputReady state, useLayoutEffect, conditional Box swap
// The contentEditable div is always rendered from first render

// Input handlers
const onInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
  setInput(e.currentTarget.innerText || '');
}, []);

const handleSend = useCallback(async () => {
  if (!input.trim() || isSending) return;
  // ... same send logic ...
  setInput('');
  if (inputRef.current) inputRef.current.innerText = '';
  inputRef.current?.focus(); // user-gesture-gated, safe
}, [input, isSending, onSend]);

const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}, [handleSend]);

// wrapSelection uses document.getSelection() + Range API
const wrapSelection = useCallback((before: string, after: string) => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const text = range.toString();
  range.deleteContents();
  range.insertNode(document.createTextNode(before + text + after));
  // focus after
  inputRef.current?.focus();
}, [input]);
```

**JSX replacement (lines 258-277):**
```tsx
<HStack spacing="2" position="relative" align="end">
  <Box position="relative" flex="1">
    <Box
      ref={inputRef}
      contentEditable="plaintext-only"
      role="textbox"
      aria-multiline="false"
      aria-label="Type a message..."
      data-placeholder="Type a message..."
      onInput={onInput}
      onKeyDown={handleKeyDown}
      className="chat-input-field"
      h={isMobile ? '44px' : '48px'}
      fontSize={isMobile ? '16px' : 'md'}
      bg={inputBg}
      border="1px solid"
      borderColor={inputBorder}
      borderRadius="xl"
      px="4"
      pr="12"
      py="2.5"
      lineHeight="1.5"
      overflow="hidden"
      whiteSpace="nowrap"
      textOverflow="ellipsis"
      _focus={{ borderColor: 'teal.400', boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.15)', outline: 'none' }}
      sx={{
        '&:empty:before': {
          content: 'attr(data-placeholder)',
          color: 'var(--chakra-colors-gray-400)',
          pointerEvents: 'none',
        },
      }}
    />
    {/* emoji button, etc. — unchanged */}
```

**Other changes:**
- Remove `inputReady` state variable (line 27)
- Remove `useLayoutEffect(() => setInputReady(true), [])` (lines 39-41)
- Remove `isDisabled={!inputReady || isSending}` prop
- Remove `_disabled` prop
- `handleSend` at line 65: change `inputRef.current?.focus()` — keep it (already user-gesture-gated)
- All other `.focus()` calls in event handlers: keep them (all user-gesture-gated)
- Preserve: formatting toolbar, emoji picker, GIF picker, poll modal, image upload — unchanged
- Preserve: `isAnnouncement` early return (line 76)

### Task 2: Fix MessageBubble edit Textarea (`src/components/chat/MessageBubble.tsx`)

**Problem**: `<Textarea autoFocus>` at line 238 auto-focuses when edit mode mounts.

**Fix**: Remove `autoFocus`, defer focus with `requestAnimationFrame`:
```tsx
// After the Textarea mounts in edit mode
useEffect(() => {
  if (isEditing) {
    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('[data-edit-textarea]');
      textarea?.focus();
    });
  }
}, [isEditing]);
```
Add `data-edit-textarea` attribute to the Textarea element.

### Task 3: Fix ChannelBottomSheet search (`src/components/chat/ChannelBottomSheet.tsx`)

**Problem**: `<Input autoFocus>` at line 116 auto-focuses when sheet opens.

**Fix**: Remove `autoFocus`. Use the existing `isOpen` prop and a `useEffect` to focus after sheet transition:
```tsx
const searchInputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  if (isOpen) {
    // Defer past sheet open animation
    const id = setTimeout(() => searchInputRef.current?.focus(), 300);
    return () => clearTimeout(id);
  }
}, [isOpen]);
```
Add `ref={searchInputRef}` to the Input. No other changes to the component.

### Task 4: Fix GifPicker search inputs (`src/components/chat/GifPicker.tsx`)

**Problem**: Two `<Input autoFocus>` at lines 74 and 162 auto-focus when the picker opens.

**Fix**: Same pattern — remove `autoFocus`, add deferred focus via `useEffect` on `isOpen`:
```tsx
// Add to component body
const searchInputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  if (isOpen) {
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }
}, [isOpen]);
```
Use `ref={searchInputRef}` on both input variants (modal + inline).

### Task 5: Fix ServiceChat Textarea (`src/components/services/ServiceChat.tsx`)

**Problem**: `<Textarea>` at line 608 is always mounted — same WKWebView auto-focus risk.

**Fix**: Replace with `contentEditable` div, same pattern as ChatInput (Task 1). Remove auto-resize height logic (contentEditable auto-grows). Keep character count. Keep `ref` for scroll-into-view logic.

### Task 6: Remove ClientOnly wrapper from chat pages

**Problem**: `ClientOnly.tsx` uses `useEffect(() => setMounted(true), [])` which causes a double render. On the first render (mounted=false), children are not rendered. On the second render (mounted=true), children mount. This means ALL components inside re-mount, which can reset focus state and give WKWebView another opportunity to scan for inputs.

**Fix**: Remove `<ClientOnly>` wrapper from:
- `src/app/(app)/chat/page.tsx` — page is already `'use client'`, no hydration mismatch possible
- `src/app/demo/chat/page.tsx` — same

Replace:
```tsx
// Before
<ClientOnly fallback={<Center>...spinner...</Center>}>
  <Box ...> ...content... </Box>
</ClientOnly>

// After
<Box ...> ...content... </Box>
```

### Task 7: Remove framer-motion swipe from chat page (`src/app/(app)/chat/page.tsx`)

**Problem**: The `<motion.div>` with `drag="x"` at line 383 may interfere with scroll/touch handling and causes additional complex rendering that could trigger focus side effects.

**Fix**: Replace with a plain `<Box>`:
```tsx
// Before
<motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} ...>
  ...content...
</motion.div>

// After
<Box display="flex" flexDir="column" flex="1" minH="0" position="relative">
  ...content...
</Box>
```
Also remove the `import { motion } from 'framer-motion'` and the `handleSwipe` callback.

### Task 8: Demo page mirror

Apply same changes to `src/app/demo/chat/page.tsx`:
- Remove `ClientOnly` wrapper
- Remove `motion.div` if present (it's not — demo page uses a different layout)

### Task 9: CSS cleanup (`src/app/globals.css`)

After replacing inputs with `contentEditable` divs, the aggressive `.keyboard-visible` CSS overrides (lines 409-437) may still be needed for Capacitor's keyboard events. Keep them for now. Only remove the `.shell-root` height override if testing confirms it's unnecessary.

Also add the placeholder CSS:
```css
.chat-input-field:empty:before {
  content: attr(data-placeholder);
  color: var(--chakra-colors-gray-400);
  pointer-events: none;
}
```

### Task 10: Remove unused imports and state

After all changes:
- `ChatInput.tsx`: Remove unused `useLayoutEffect` import, `inputReady` state
- `chat/page.tsx`: Remove unused `motion` import, unused framer-motion related code
- `MessageBubble.tsx`: Clean up unused imports if any

## Validation

1. `npm run build` — must succeed with zero errors
2. `npm run lint` — must pass
3. Run on iOS simulator:
   - Navigate to chat page → keyboard must NOT auto-open
   - Tap message input → keyboard must open
   - Type and send → keyboard must stay open
   - Edit message → keyboard must open on tap, not on page load
   - Open channel bottom sheet → search input focuses on sheet open (not on page load)
   - Open GIF picker → search focuses on picker open (not on page load)
4. Run on Android:
   - Verify all chat features work (no platform regression)
5. Run on web:
   - Verify all chat features work (type, send, emoji, GIF, poll, edit, delete, reactions)
   - Verify keyboard CSS classes (`body.keyboard-visible`) still work for web mobile

## Rollback

If the `contentEditable` approach introduces regressions (paste handling, selection API, etc.), fall back to the "Tap to compose" pattern:
1. Render a styled non-focusable `<Box>` that looks like the input bar, saying "Tap to type"
2. On click/tap, mount the real `<Input>` and focus it
3. This guarantees no keyboard auto-show because no input exists in the DOM until user interaction

## Why This Fixes It

1. `<div contentEditable>` is NOT auto-focused by WKWebView — it's not a form control, it's editable content
2. No `<input>` or `<textarea>` exists in the DOM on initial page load, so WKWebView has nothing to target
3. Removing `autoFocus` eliminates programmatic auto-focus from edit/search/GIF flows
4. Removing `ClientOnly` eliminates the double-render that could reset focus mid-load
5. All remaining `.focus()` calls are inside user event handlers (tap/click/keydown), which are safe — iOS only shows the keyboard when focus comes from a user gesture
