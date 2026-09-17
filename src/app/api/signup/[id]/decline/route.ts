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

    // Fetch the service
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id, title, date, church_id')
      .eq('id', signupRequest.service_id)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const churchId = service.church_id;

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

    const { error: updateError } = await supabaseAdmin
      .from('signup_requests')
      .update({ status: 'declined' })
      .eq('id', id);

    if (updateError) {
      console.error('[Signup Decline] Failed to update:', updateError);
      return NextResponse.json({ error: 'Failed to decline signup request' }, { status: 500 });
    }

    // Notify the volunteer
    if (signupRequest.team_member_id) {
      const { data: teamMember } = await supabaseAdmin
        .from('team_members')
        .select('user_id')
        .eq('id', signupRequest.team_member_id)
        .single();

      if (teamMember?.user_id) {
        try {
          await supabaseAdmin.from('notifications').insert({
            church_id: churchId,
            user_id: teamMember.user_id,
            type: 'signup_request_response',
            title: 'Signup declined',
            message: `Your request for ${signupRequest.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} on ${service.title} (${service.date}) was declined.`,
            service_id: signupRequest.service_id,
            link_url: `/services/${signupRequest.service_id}`,
            read: false,
          });
        } catch {} // notification failure is non-critical
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Signup Decline] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
