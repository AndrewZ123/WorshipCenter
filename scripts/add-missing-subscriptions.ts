/**
 * This script adds trial subscriptions to existing churches that don't have one.
 * Run this after deploying the new migration to fix users who signed up before
 * the subscription was added to the signup flow.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMissingSubscriptions() {
  console.log('Finding churches without subscriptions...');
  
  // Get all churches
  const { data: churches, error: churchesError } = await supabase
    .from('churches')
    .select('id, name');
  
  if (churchesError) {
    console.error('Error fetching churches:', churchesError);
    process.exit(1);
  }
  
  console.log(`Found ${churches?.length || 0} churches`);
  
  // Check each church for a subscription
  let addedCount = 0;
  let skippedCount = 0;
  
  for (const church of churches || []) {
    const { data: existingSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('church_id', church.id)
      .maybeSingle();
    
    if (subError) {
      console.error(`Error checking subscription for ${church.name}:`, subError);
      continue;
    }
    
    if (existingSubscription) {
      console.log(`✓ ${church.name} already has a subscription`);
      skippedCount++;
    } else {
      console.log(`✗ ${church.name} is missing a subscription - adding...`);
      
      // Add a trial subscription
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          church_id: church.id,
          stripe_customer_id: `cus_pending_${church.id}`,
          stripe_subscription_id: null,
          status: 'trialing',
          trial_start: new Date().toISOString(),
          trial_end: trialEnd.toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: trialEnd.toISOString(),
        });
      
      if (insertError) {
        console.error(`  Error adding subscription for ${church.name}:`, insertError);
      } else {
        console.log(`  ✓ Subscription added successfully (trial ends ${trialEnd.toLocaleDateString()})`);
        addedCount++;
      }
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Added subscriptions: ${addedCount}`);
  console.log(`Already had subscriptions: ${skippedCount}`);
  console.log('Done!');
}

addMissingSubscriptions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });