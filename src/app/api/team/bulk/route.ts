import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Bulk update roles
const BulkRoleUpdateSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(100),
  role: z.enum(['admin', 'leader', 'team']),
});

// Bulk delete
const BulkDeleteSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(100),
});

// Bulk add to group
const BulkGroupAddSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(100),
  groupId: z.string().uuid(),
});

export async function PATCH(req: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'No church context' }, { status: 400 });
    }

    if (userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === 'updateRole') {
      const parsed = BulkRoleUpdateSchema.safeParse({
        memberIds: body.memberIds,
        role: body.role,
      });
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('team_members')
        .update({ role: parsed.data.role })
        .in('id', parsed.data.memberIds)
        .eq('church_id', userData.church_id)
        .select('id');

      if (error) {
        console.error('[BulkTeam] updateRole error:', error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
      }
      return NextResponse.json({ updated: data?.length || 0 });
    }

    if (action === 'addToGroup') {
      const parsed = BulkGroupAddSchema.safeParse({
        memberIds: body.memberIds,
        groupId: body.groupId,
      });
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
      }

      // Verify group belongs to church
      const { data: group } = await supabase
        .from('member_groups')
        .select('id')
        .eq('id', parsed.data.groupId)
        .eq('church_id', userData.church_id)
        .single();
      if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }

      const rows = parsed.data.memberIds.map((id) => ({
        group_id: parsed.data.groupId,
        team_member_id: id,
      }));

      const { data, error } = await supabase
        .from('member_group_members')
        .upsert(rows, { onConflict: 'group_id,team_member_id' })
        .select('id');

      if (error) {
        console.error('[BulkTeam] addToGroup error:', error);
        return NextResponse.json({ error: 'Failed to add to group' }, { status: 500 });
      }
      return NextResponse.json({ added: data?.length || 0 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[BulkTeam] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'No church context' }, { status: 400 });
    }

    if (userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = BulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    // Don't allow deleting yourself
    const { data: currentMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('church_id', userData.church_id)
      .single();

    const safeIds = parsed.data.memberIds.filter(
      (id) => id !== currentMember?.id
    );

    if (!safeIds.length) {
      return NextResponse.json({ error: 'No valid members to delete' }, { status: 400 });
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .in('id', safeIds)
      .eq('church_id', userData.church_id);

    if (error) {
      console.error('[BulkTeam] DELETE error:', error);
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }

    return NextResponse.json({ deleted: safeIds.length });
  } catch (error) {
    console.error('[BulkTeam] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}