import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendAssignmentNotification } from '@/lib/notifications';
import { z } from 'zod';

const BulkAssignmentSchema = z.object({
  serviceId: z.string().uuid(),
  assignments: z
    .array(
      z.object({
        team_member_id: z.string().uuid(),
        role: z.string().min(1).max(100).optional().default('Team Member'),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'No church context' }, { status: 400 });
    }

    if (userData.role === 'team') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = BulkAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { serviceId, assignments } = parsed.data;

    // Verify the service belongs to this church
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id, title, date')
      .eq('id', serviceId)
      .eq('church_id', userData.church_id)
      .single();

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Verify team members belong to this church
    const memberIds = assignments.map(a => a.team_member_id);
    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('id, user_id')
      .in('id', memberIds)
      .eq('church_id', userData.church_id);

    const validMemberIds = new Set((members || []).map(m => m.id));
    const validAssignments = assignments.filter(a => validMemberIds.has(a.team_member_id));

    if (!validAssignments.length) {
      return NextResponse.json({ error: 'No valid team members found' }, { status: 400 });
    }

    // Bulk insert
    const rows = validAssignments.map(a => ({
      service_id: serviceId,
      team_member_id: a.team_member_id,
      role: a.role,
      status: 'pending',
    }));

    const { data: created, error: insertError } = await supabaseAdmin
      .from('service_assignments')
      .insert(rows)
      .select();

    if (insertError || !created?.length) {
      console.error('[BulkAssignments] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create assignments' },
        { status: 500 }
      );
    }

    // Fire-and-forget notifications
    const memberMap = new Map((members || []).map(m => [m.id, m]));
    for (const assignment of created) {
      const member = memberMap.get(assignment.team_member_id);
      if (member?.user_id) {
        sendAssignmentNotification({
          userId: member.user_id,
          serviceId,
          serviceName: service.title,
          role: assignment.role,
          serviceDate: service.date,
          organizationId: userData.church_id,
        }).catch((err) =>
          console.error('[BulkAssignments] notification error:', err)
        );
      }
    }

    return NextResponse.json({ created: created.length, assignments: created });
  } catch (error) {
    console.error('[BulkAssignments] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}