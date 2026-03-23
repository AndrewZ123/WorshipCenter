import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import { sendConfirmationNotification } from '@/lib/notifications';
import type { ServiceAssignment } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;

    // Get user's church_id from the users table
    const { data: userData } = await supabase
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the assignment to verify ownership (this includes service data)
    const assignment = await db.assignments.getById(assignmentId, userData.church_id);
    
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Get the team member to verify user owns this assignment
    const teamMember = await db.teamMembers.getById(assignment.team_member_id, userData.church_id);
    
    if (!teamMember || teamMember.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Confirm the assignment
    const confirmedAssignment = await db.assignments.confirm(assignmentId, userData.church_id);

    if (!confirmedAssignment) {
      return NextResponse.json({ error: 'Failed to confirm assignment' }, { status: 500 });
    }

    // Get the service for notification context
    const service = await db.services.getById(assignment.service_id, userData.church_id);

    if (service) {
      // Notify leaders about the confirmation
      // Get all team members with admin/leader role for this church
      const teamMembers = await db.teamMembers.getByChurch(userData.church_id);
      const leaders = teamMembers.filter(tm => 
        tm.roles.includes('admin') || tm.roles.includes('leader')
      );

      // Send notification to each leader
      for (const leader of leaders) {
        if (!leader.user_id || leader.user_id === user.id) continue; // Don't notify self or leaders without user accounts

        await sendConfirmationNotification({
          leaderId: leader.user_id,
          serviceId: service.id,
          serviceName: service.title,
          userName: teamMember.name,
          role: assignment.role,
          serviceDate: service.date,
          organizationId: userData.church_id,
        });
      }
    }

    return NextResponse.json({ assignment: confirmedAssignment });
  } catch (error) {
    console.error('[Assignment Confirm] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}