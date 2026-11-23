import { supabaseAdmin } from '@/lib/supabase';

/**
 * Apply an approved swap through the SQL RPC. The function re-checks the
 * claimed status, the current assignment owner, and moves the assignment in a
 * single transaction so concurrent approvals cannot both win.
 *
 * Returns false (and logs) when the swap is no longer approvable.
 */
export async function approveSwapAssignment(
  swapId: string,
  churchId: string,
  actorUserId: string | null
): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc('approve_assignment_swap', {
    p_swap_id: swapId,
    p_church_id: churchId,
    p_actor_user_id: actorUserId,
  });

  if (error) {
    console.error('[Swaps] Approve RPC failed:', error);
    return false;
  }

  return true;
}
