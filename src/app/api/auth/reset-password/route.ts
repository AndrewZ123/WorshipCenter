import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get the app URL from environment variable (server-side reads at runtime)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.worshipcenter.app';

    console.log('[Reset Password API] Sending reset email to:', email);
    console.log('[Reset Password API] Redirect URL:', `${appUrl}/new-password`);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/new-password`,
    });

    if (error) {
      console.error('[Reset Password API] Error:', error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Reset Password API] Exception:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}