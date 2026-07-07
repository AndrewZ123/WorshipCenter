# Add type icons to service order items in public share view

**Goal:** Replace the plain number next to each service order item on the public share page with an icon that distinguishes songs from segments.

## Changes

### File: `src/app/share/[token]/ShareView.tsx`

1. **Import** `FileText` from `lucide-react` (alongside existing `Calendar, Clock, Music, Users`).
2. **In the item map** (around line 132–135), replace:
   ```tsx
   <Text fontSize="sm" fontWeight="700" color={subtextColor} minW="24px" pt="1px">
     {i + 1}
   </Text>
   ```
   with:
   ```tsx
   <Box minW="24px" pt="1px" color={subtextColor}>
     {item.type === 'song' ? <Music size={16} /> : <FileText size={16} />}
   </Box>
   ```

## Validation

- `npx tsc --noEmit` passes
- No new lint warnings
