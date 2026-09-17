import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the signup request
    const { data: signupRequest, error: fetchError } = await supabaseAdmin
      .from('signup_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !signupRequest) {
      return NextResponse.json({ error: 'Signup request not found' }, { status: 404 });
    }

    // Fetch the service separately
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id, title, date, time, church_id')
      .eq('id', signupRequest.service_id)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const churchId = service.church_id;

    // Verify the current user is an admin/leader of this church
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .eq('church_id', churchId)
      .single();

    if (!currentUser || !['admin', 'leader'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (signupRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Signup request is already processed' }, { status: 400 });
    }

    let teamMemberId = signupRequest.team_member_id;

    // If no team_member_id, create a new team member
    if (!teamMemberId) {
      const { data: newMember, error: createError } = await supabaseAdmin
        .from('team_members')
        .insert({
          church_id: churchId,
          name: signupRequest.name || 'New Member',
          email: signupRequest.email || '',
          phone: signupRequest.phone || '',
          roles: [signupRequest.role],
        })
        .select()
        .single();

      if (createError || !newMember) {
        console.error('[Signup Approve] Failed to create team member:', createError);
        return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 });
      }

      teamMemberId = newMember.id;
    }

    // Check for existing assignment to avoid UNIQUE constraint violation
    const { data: existingAssignment } = await supabaseAdmin
      .from('service_assignments')
      .select('id')
      .eq('service_id', signupRequest.service_id)
      .eq('team_member_id', teamMemberId)
      .eq('role', signupRequest.role)
      .maybeSingle();

    let assignment;
    if (existingAssignment) {
      // Update existing assignment to confirmed
      const { data: updated } = await supabaseAdmin
        .from('service_assignments')
        .update({ status: 'confirmed' })
        .eq('id', existingAssignment.id)
        .select()
        .single();
      assignment = updated;
    } else {
      // Create the service assignment
      const { data: created, error: assignError } = await supabaseAdmin
        .from('service_assignments')
        .insert({
          service_id: signupRequest.service_id,
          team_member_id: teamMemberId,
          role: signupRequest.role,
          status: 'confirmed',
        })
        .select()
        .single();

      if (assignError) {
        console.error('[Signup Approve] Failed to create assignment:', assignError);
        return NextResponse.json({ error: `Failed to create assignment: ${assignError.message}` }, { status: 500 });
      }
      assignment = created;
    }

    // Update signup request status to approved
    const { error: updateError } = await supabaseAdmin
      .from('signup_requests')
      .update({ status: 'approved' })
      .eq('id', id);

    if (updateError) {
      console.error('[Signup Approve] Failed to update signup request:', updateError);
    }

    // Update team member's roles if the role isn't already in their list
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('roles')
      .eq('id', teamMemberId)
      .single();

    if (member && !member.roles.includes(signupRequest.role)) {
      await supabaseAdmin
        .from('team_members')
        .update({ roles: [...member.roles, signupRequest.role] })
        .eq('id', teamMemberId);
    }

    // Notify the volunteer — query team_members for user_id (the relationship is team_members.user_id -> auth.users)
    const { data: teamMember } = await supabaseAdmin
      .from('team_members')
      .select('user_id')
      .eq('id', teamMemberId)
      .single();

    if (teamMember?.user_id) {
      try {
        await supabaseAdmin.from('notifications').insert({
          church_id: churchId,
          user_id: teamMember.user_id,
          type: 'signup_request_response',
          title: 'Signup approved!',
          message: `You've been approved for ${signupRequest.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} on ${service.title} (${service.date}).`,
          service_id: signupRequest.service_id,
          link_url: `/services/${signupRequest.service_id}`,
          read: false,
        });
      } catch {} // notification failure is non-critical
    }

    return NextResponse.json({ success: true, data: { assignment } });
  } catch (error) {
    console.error('[Signup Approve] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
