# Reduce gap between chat input and keyboard

## Problem
The bottom padding on `.chat-input-area` on mobile is 8px (`p={{ base: '2', md: '4' }}` in Chakra, where `2` = 8px). This creates a visible gap between the bottom of the input row and the keyboard. User wants this reduced to 0-2px.

## Change

**File:** `src/components/chat/ChatInput.tsx`

On line 105, change the padding from:
```tsx
p={{ base: '2', md: '4' }}
```
to:
```tsx
p={{ base: '2', md: '4' }} pb={{ base: '0.5', md: '4' }}
```

This keeps the existing 8px padding on top/left/right but reduces bottom padding to 2px (`0.5` in Chakra = 2px) on mobile. Desktop (`md+`) unchanged at 16px.

## Validation
1. Run `npx tsc --noEmit` to verify no type errors
2. Run `npx eslint src/components/chat/ChatInput.tsx` for lint
3. Test on mobile device or emulator — tap input to open keyboard, verify the gap is ~2px
