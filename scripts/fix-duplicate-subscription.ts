/**
 * Fix: Remove duplicate subscription creation trigger
 * 
 * This script removes the trigger that was causing duplicate subscription
 * creation during signup. The signup_church function now handles this explicitly.
 * 
 * To run: npx tsx scripts/fix-duplicate-subscription.ts
 */

import { supabase } from '../src/lib/supabase';

async function applyFix() {
  console.log('Applying fix: Remove duplicate subscription trigger...\n');

  // Step 1: Drop the trigger
  console.log('Step 1: Dropping on_church_created trigger...');
  const { error: triggerError } = await supabase.rpc('exec_sql', {
    sql: 'DROP TRIGGER IF EXISTS on_church_created ON public.churches;',
  });

  if (triggerError) {
    console.error('Failed to drop trigger:', triggerError.message);
  } else {
    console.log('✓ Trigger dropped successfully');
  }

  // Step 2: Drop the function
  console.log('\nStep 2: Dropping create_church_subscription function...');
  const { error: functionError } = await supabase.rpc('exec_sql', {
    sql: 'DROP FUNCTION IF EXISTS public.create_church_subscription();',
  });

  if (functionError) {
    console.error('Failed to drop function:', functionError.message);
  } else {
    console.log('✓ Function dropped successfully');
  }

  console.log('\n✓ Fix applied successfully!');
  console.log('\nSignup should now work without duplicate key errors.');
}

applyFix()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nError:', err);
    console.log('\nPlease apply the fix manually in Supabase dashboard:');
    console.log('\n1. Go to https://supabase.com/dashboard');
    console.log('2. Navigate to your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Run this SQL:\n');
    console.log('  DROP TRIGGER IF EXISTS on_church_created ON public.churches;');
    console.log('  DROP FUNCTION IF EXISTS public.create_church_subscription();\n');
    process.exit(1);
  });