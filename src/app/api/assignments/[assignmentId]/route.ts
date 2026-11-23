import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { AssignmentParamsSchema, invalidInputResponse } from '@/lib/validation';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `assignments-delete:${user.id}`,
      RateLimitTiers.API_WRITE.requests,
      RateLimitTiers.API_WRITE.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const subscriptionCheck = await requireActiveSubscription(request);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    const paramsResult = AssignmentParamsSchema.safeParse(await params);
    if (!paramsResult.success) {
      return invalidInputResponse();
    }
    const { assignmentId } = paramsResult.data;

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (userData.role === 'team') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: assignment } = await supabaseAdmin
      .from('service_assignments')
      .select('id, service_id')
      .eq('id', assignmentId)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', assignment.service_id)
      .eq('church_id', userData.church_id)
      .single();

    if (!service) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('service_assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) {
      console.error('[Delete] Error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Delete] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}