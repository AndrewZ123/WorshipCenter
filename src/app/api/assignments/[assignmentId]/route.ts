import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;

    const { data: userData } = await supabase
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Only admins/leaders can delete assignments
    if (userData.role === 'team') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify assignment belongs to a service in this church
    const { data: assignment } = await supabase
      .from('service_assignments')
      .select('id, service_id')
      .eq('id', assignmentId)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const { data: service } = await supabase
      .from('services')
      .select('id')
      .eq('id', assignment.service_id)
      .eq('church_id', userData.church_id)
      .single();

    if (!service) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete assignment silently
    const { error: deleteError } = await supabase
      .from('service_assignments')
      .delete()
      .eq('id', assignmentId);

    if (deleteError) {
      console.error('[Assignment Delete] Error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Assignment Delete] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}