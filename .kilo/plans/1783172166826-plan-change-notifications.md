# Plan-Change Notifications

## Summary

When a service plan changes (key changed, item added, item removed), fire an **automatic in-app notification** to all assigned members + leaders. On save, show a **debounced toast** with an optional "Notify team via email?" action. The email prompt includes a diff preview.

## Triggers

Only these plan changes trigger notifications:

| Trigger | Source handler |
|---|---|
| Key changed (song) | `handleSaveItem` — compare `editingItem.key` vs new `itemKey` |
| Item added | `handleSaveAddSong` / `handleSaveAddSegment` |
| Item removed | `handleDeleteItem` |

**NOT triggers:** reorder (drag), title/notes/duration changes, service metadata (title/date/time/status).

## Recipients

- All **assigned members** (`assignments` → `teamMembers.user_id`)
- All **leaders** (users with `role !== 'team'`)

In-app notification goes to all recipients. Email (if opted in) goes to all recipients with a known email.

## Infrastructure (reused)

- `src/lib/notifications.ts` — existing `sendNotification` / `sendEmail`
- `src/lib/store.ts` — `store.notifications.create` for in-app
- `resend` via `src/lib/email.ts`

## Files to create

### `src/lib/planChanges.ts`

```typescript
interface PlanChange {
  type: 'key_changed' | 'item_added' | 'item_removed';
  itemTitle: string;
  itemType: 'song' | 'segment';
  oldKey?: string;
  newKey?: string;
}
```

Exports:
- `computeKeyChange(prevItem: ServiceItem, newKey: string): PlanChange | null`
- `computeItemAdded(item: ServiceItem): PlanChange`
- `computeItemRemoved(item: ServiceItem): PlanChange`
- `formatChangesSummary(changes: PlanChange[]): string` — human-readable text for email/toast

### `src/app/api/notifications/send-plan-change/route.ts`

POST handler — accepts `{ serviceId, churchId, changes: PlanChange[] }`. For each recipient:
1. Build an email with the diff summary
2. Call `sendEmail` (via Resend) with the formatted changes

## Files to modify

### `src/lib/notifications.ts`

Add `PLAN_CHANGE = 'PLAN_CHANGE'` to the `NotificationType` enum.

### `src/lib/types.ts`

Add `'plan_change'` to the `Notification.type` union (line ~191).

### `src/app/(app)/services/[id]/ServiceDetailClient.tsx`

Add a `useRef<PlanChange[]>` to accumulate changes during a debounce window. In each of the 4 handlers:

1. **`handleSaveItem`** — after successful update, if `editingItem.key !== itemKey` and type is `'song'`, push `computeKeyChange(editingItem, itemKey)` to the accumulator.
2. **`handleSaveAddSong`** — after successful create, push `computeItemAdded(newItem)`.
3. **`handleSaveAddSegment`** — same as above.
4. **`handleDeleteItem`** — before deletion, capture the item. After successful delete, push `computeItemRemoved(item)`.

After pushing to the accumulator, **reset the debounce timer** (5s `setTimeout`). When the timer fires:

1. Send **in-app notifications** immediately (always, no prompt) via `store.notifications.create` for each recipient.
2. Show a Chakra **toast** with `status: "info"`, `duration: 10000`, `isClosable: true`, and `render` with:
   - Summary text: `"Plan changes saved."`
   - Diff list (truncated to 3 lines + "and N more…")
   - An action button: **"Notify Team"** — calls the `/api/notifications/send-plan-change` endpoint, then updates the toast to "Team notified."

### Toast debounce logic (pseudocode)

```typescript
const pendingChanges = useRef<PlanChange[]>([]);
const debounceTimer = useRef<NodeJS.Timeout | null>(null);

function accumulatePlanChange(change: PlanChange) {
  pendingChanges.current.push(change);
  if (debounceTimer.current) clearTimeout(debounceTimer.current);
  debounceTimer.current = setTimeout(() => flushPlanChanges(), 5000);
}

async function flushPlanChanges() {
  const changes = pendingChanges.current;
  pendingChanges.current = [];
  debounceTimer.current = null;
  if (changes.length === 0) return;

  // 1. Send in-app notifications automatically
  await sendInAppNotifications(recipients, changes);

  // 2. Show toast with email option
  showToastWithEmailAction(changes);
}
```

## No new migration

The `notifications` table already supports arbitrary `type` values. No schema change needed.

## Validation

1. Edit a song key → save → verify in-app notification created in DB → verify toast appears → click "Notify Team" → verify email sent.
2. Delete an item → same flow.
3. Add a song → same flow.
4. Multiple quick saves → verify only one toast with combined diff.
5. Key change on a segment (not a song) → verify no notification.
