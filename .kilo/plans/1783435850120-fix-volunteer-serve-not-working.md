# Fix: Volunteer Serve Page Shows No Open Positions

## Root Cause

The `store.rolePositions.getOpenForChurch()` method at `src/lib/store.ts:2822` uses a Supabase `!inner` join query that:

1. **Filters on joined-table columns** (`services.date`, `services.status`) — no other query in the codebase does this
2. **Orders by a joined-table column** (`services.date`) — no other query in the codebase does this  
3. **Never checks `error` from the response** — silent failure returns `[]`

When PostgREST can't resolve the joined-column filter/order, or when the `service_role_positions` table doesn't exist (migration not applied), the query returns `{ data: null, error: ... }`. Since the store method only destructures `data` (not `error`) and returns `data || []`, it silently returns `[]` to the serve page, which renders "No open positions right now."

## Fix: `src/lib/store.ts` — `getOpenForChurch`

Replace the complex joined query with a two-step approach: fetch positions, then fetch matching services, then filter/join/sort in JavaScript. This is more robust and consistent with the codebase patterns.

**Changes to `rolePositions.getOpenForChurch`:**

```typescript
// Before (broken):
getOpenForChurch: async (churchId: string) => {
  const { data } = await supabase
    .from('service_role_positions')
    .select('*, services!inner(id, title, date, time, status)')
    .eq('church_id', churchId)
    .eq('signup_enabled', true)
    .gte('services.date', new Date().toISOString().split('T')[0])
    .in('services.status', ['draft', 'finalized'])
    .order('services.date', { ascending: true });
  return (data || []) as (ServiceRolePosition & { services: Service })[];
},

// After (fixed):
getOpenForChurch: async (churchId: string) => {
  const { data: positions, error } = await supabase
    .from('service_role_positions')
    .select('*')
    .eq('church_id', churchId)
    .eq('signup_enabled', true);

  if (error) {
    console.error('[RolePositions] getOpenForChurch error:', error);
    return [];
  }

  if (!positions || positions.length === 0) return [];

  const serviceIds = [...new Set(positions.map(p => p.service_id))];
  const { data: services } = await supabase
    .from('services')
    .select('id, title, date, time, status')
    .in('id', serviceIds)
    .in('status', ['draft', 'finalized']);

  const today = new Date().toISOString().split('T')[0];
  const validServices = (services || []).filter(s => s.date >= today);
  const validServiceIds = new Set(validServices.map(s => s.id));

  return positions
    .filter(p => validServiceIds.has(p.service_id))
    .map(p => ({
      ...p,
      services: validServices.find(s => s.id === p.service_id)!,
    }))
    .sort((a, b) => a.services.date.localeCompare(b.services.date)) as any;
},
```

## Verification Steps

1. Run `npx tsc --noEmit` — must pass with zero errors
2. Run `npm run build` — must build successfully
3. Open the browser console, navigate to `/serve` as a volunteer
4. Verify no Supabase query errors in console
5. Verify the "No open positions right now" empty state is only shown when truly no positions exist
