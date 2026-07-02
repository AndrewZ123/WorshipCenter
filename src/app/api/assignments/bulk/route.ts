import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's church_id and role
    const { data: userData } = await supabase
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'No church context' }, { status: 400 });
    }

    // Only admins/leaders can bulk-assign
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

    const rows = assignments.map((a) => ({
      service_id: serviceId,
      team_member_id: a.team_member_id,
      role: a.role,
    }));

    const created = await db.assignments.bulkCreate(rows, userData.church_id);
    if (!created.length) {
      return NextResponse.json(
        { error: 'Failed to create assignments' },
        { status: 500 }
      );
    }

    // Fetch service details and team member user IDs for notifications
    const service = await db.services.getById(serviceId, userData.church_id);
    const teamMemberIds = [...new Set(created.map((a: any) => a.team_member_id))];
    const teamMembers = await db.teamMembers.getByChurch(userData.church_id);
    const memberMap = new Map(teamMembers.map((m) => [m.id, m]));

    // Fire-and-forget notifications
    for (const assignment of created) {
      const member = memberMap.get(assignment.team_member_id);
      if (member?.user_id && service) {
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