import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { sanitizeRequestBody } from '@/lib/auth-middleware';

// Lazy initialization of Supabase client
const getSupabase = () => createClient(
  env.supabaseUrl(),
  env.supabaseServiceRoleKey()
);

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const sanitized = sanitizeRequestBody(body);
    const { paymentIntentId } = sanitized;

    // Validate paymentIntentId
    if (!paymentIntentId || typeof paymentIntentId !== 'string' || paymentIntentId.trim().length === 0) {
      return NextResponse.json(
        { error: 'paymentIntentId is required' },
        { status: 400 }
      );
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's church
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.church_id) {
      console.error('[Confirm Payment] User not found or missing church:', user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the payment intent exists in our database (if we're tracking it)
    // For now, we just acknowledge of payment succeeded
    // The webhook will handle creating the Stripe subscription

    console.log(`[Confirm Payment] Payment confirmed for church ${userData.church_id}, user ${user.id}, paymentIntent ${paymentIntentId}`);

    return NextResponse.json({ 
      success: true,
      message: 'Payment confirmed successfully. Your subscription is being activated.',
    });
  } catch (error) {
    console.error('[Confirm Payment] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}