/**
 * Migration Script: Add youtube_video_id column to songs table
 *
 * This script applies the migration to add the youtube_video_id column to the songs table.
 *
 * To run this script:
 * 1. Make sure your .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 2. Run: npx tsx scripts/apply-migration.ts
 *
 * Alternatively, you can run the SQL directly in your Supabase dashboard:
 * - Go to Supabase Dashboard > SQL Editor
 * - Run: ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;
 */

import { supabase } from '../src/lib/supabase';

async function applyMigration() {
  console.log('Applying migration: Add youtube_video_id column to songs table...');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;',
  });

  if (error) {
    console.error('Migration failed:', error);

    // Fallback: Try direct SQL execution via raw query
    console.log('\nTrying alternative approach...');
    const { error: altError } = await supabase
      .from('songs')
      .select('youtube_video_id')
      .limit(1);

    if (altError && altError.message.includes('column') || altError?.code === '42P01') {
      console.log('\nColumn does not exist. Please run the migration manually in Supabase dashboard:');
      console.log('\n1. Go to https://supabase.com/dashboard');
      console.log('2. Navigate to your project');
      console.log('3. Go to SQL Editor');
      console.log('4. Run this SQL:');
      console.log('\n  ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;\n');
      return;
    }

    if (!altError) {
      console.log('✓ Column already exists or was added successfully');
      return;
    }

    console.error('\nAlternative approach also failed:', altError);
    return;
  }

  console.log('✓ Migration applied successfully!');
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    console.log('\nPlease run the migration manually in Supabase dashboard:');
    console.log('SQL: ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;');
    process.exit(1);
  });
