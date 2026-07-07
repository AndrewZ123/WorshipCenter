import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token, platform } = await request.json();

    if (!token || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: token, platform' },
        { status: 400 }
      );
    }

    if (!['ios', 'android'].includes(platform)) {
      return NextResponse.json(
        { error: 'Platform must be ios or android' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('device_tokens')
      .select('id')
      .eq('token', token)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('device_tokens')
        .update({
          user_id: user.id,
          platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('device_tokens')
        .insert({
          user_id: user.id,
          token,
          platform,
          is_active: true,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Push Register] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
