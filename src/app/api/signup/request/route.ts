import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { serviceId, role, teamMemberId, name, email, phone, churchId } = body;

    if (!serviceId || !role || !churchId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user belongs to this church
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.church_id !== churchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Auto-resolve team_member_id from the signing user if not provided
    let resolvedTeamMemberId = teamMemberId;
    if (!resolvedTeamMemberId) {
      const { data: tm } = await supabaseAdmin
        .from('team_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('church_id', churchId)
        .maybeSingle();
      if (tm) resolvedTeamMemberId = tm.id;
    }

    // Verify the service exists and belongs to this church
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id, title, date')
      .eq('id', serviceId)
      .eq('church_id', churchId)
      .single();

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Check the role position exists and has signup enabled
    const { data: position } = await supabaseAdmin
      .from('service_role_positions')
      .select('*')
      .eq('service_id', serviceId)
      .eq('role', role)
      .single();

    if (!position) {
      return NextResponse.json({ error: 'Position not found for this role' }, { status: 404 });
    }

    if (!position.signup_enabled) {
      return NextResponse.json({ error: 'Signup is not enabled for this position' }, { status: 400 });
    }

    // Count current assignments for this role
    const { count: assignmentCount } = await supabaseAdmin
      .from('service_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('service_id', serviceId)
      .eq('role', role);

    // Count pending signup requests for this role
    const { count: pendingCount } = await supabaseAdmin
      .from('signup_requests')
      .select('*', { count: 'exact', head: true })
      .eq('service_id', serviceId)
      .eq('role', role)
      .eq('status', 'pending');

    const totalFilledOrPending = (assignmentCount || 0) + (pendingCount || 0);
    if (totalFilledOrPending >= position.max_volunteers) {
      return NextResponse.json({ error: 'This position is full' }, { status: 400 });
    }

    // Check if the user already has a pending signup for this service/role
    if (resolvedTeamMemberId) {
      const { data: existing } = await supabaseAdmin
        .from('signup_requests')
        .select('id')
        .eq('service_id', serviceId)
        .eq('role', role)
        .eq('team_member_id', resolvedTeamMemberId)
        .neq('status', 'declined')
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'You already have a signup request for this position' }, { status: 409 });
      }

      // Check if already assigned to this role
      const { data: existingAssignment } = await supabaseAdmin
        .from('service_assignments')
        .select('id')
        .eq('service_id', serviceId)
        .eq('team_member_id', resolvedTeamMemberId)
        .eq('role', role)
        .maybeSingle();

      if (existingAssignment) {
        return NextResponse.json({ error: 'You are already assigned to this position' }, { status: 409 });
      }
    }

    // Create the signup request
    const { data: signupRequest, error: insertError } = await supabaseAdmin
      .from('signup_requests')
      .insert({
        service_id: serviceId,
        role,
        team_member_id: resolvedTeamMemberId || null,
        name: name || '',
        email: email || '',
        phone: phone || '',
        status: 'pending',
        church_id: churchId,
      })
      .select()
      .single();

    if (insertError || !signupRequest) {
      console.error('[Signup] Failed to create request:', insertError);
      return NextResponse.json({ error: 'Failed to create signup request' }, { status: 500 });
    }

    // Notify admins about the new signup request (in-app notifications)
    const requesterName = name || 'A team member';
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('church_id', churchId)
      .in('role', ['admin', 'leader']);

    for (const admin of admins || []) {
      if (admin.id === user.id) continue;
      try {
        await supabaseAdmin.from('notifications').insert({
          church_id: churchId,
          user_id: admin.id,
          type: 'signup_request',
          title: `New signup request`,
          message: `${requesterName} wants to sign up as ${role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} for ${service.title} on ${service.date}.`,
          service_id: serviceId,
          link_url: `/services/${serviceId}`,
          read: false,
        });
      } catch {} // notification failure is non-critical
    }

    return NextResponse.json({ success: true, data: signupRequest });
  } catch (error) {
    console.error('[Signup Request] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
