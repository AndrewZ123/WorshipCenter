import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  checkRateLimit,
  getRequestUser,
  rateLimitResponse,
} from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { hasPermission } from '@/lib/rbac';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import {
  SONG_CSV_MAX_BYTES,
  buildSongImportPreview,
  parseSongsCsv,
  type ExistingSongForImport,
  type SongCsvRowError,
  type SongImportPreviewRow,
} from '@/lib/songs/csvImport';

const SongCsvImportRequestSchema = z.object({
  csv: z.string().min(1).max(SONG_CSV_MAX_BYTES),
  mode: z.enum(['preview', 'import']).default('preview'),
  updateExisting: z.boolean().default(false),
});

interface SongUpdatePayload {
  default_key?: string;
  ccli_number?: string;
  tags?: string[];
}

function insertPayload(row: SongImportPreviewRow, churchId: string) {
  // church_id always comes from the authenticated profile, never from the
  // request body. The admin client bypasses RLS, so this is the tenant guard.
  return {
    church_id: churchId,
    title: row.title,
    artist: row.artist,
    default_key: row.defaultKey || 'C',
    ccli_number: row.ccliNumber,
    tags: row.tags,
  };
}

// POST /api/songs/import/csv
// Body: { csv: string, mode: 'preview' | 'import', updateExisting?: boolean }
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Same permission as creating a song: admin or leader, never team.
    if (!hasPermission(user.role, 'songs', 'create')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const limit = checkRateLimit(
      `songs-csv-import:${user.id}`,
      RateLimitTiers.API_WRITE.requests,
      RateLimitTiers.API_WRITE.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const subscriptionCheck = await requireActiveSubscription(req);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsedBody = SongCsvImportRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { csv, mode, updateExisting } = parsedBody.data;
    const parseResult = parseSongsCsv(csv);
    if (!parseResult.ok) {
      return NextResponse.json({ error: parseResult.error }, { status: 400 });
    }

    const { data: existingData, error: existingError } = await supabaseAdmin
      .from('songs')
      .select('id,title,artist,ccli_number')
      .eq('church_id', user.church_id);

    if (existingError) {
      console.error('[API] Song CSV existing-library lookup error:', existingError);
      return NextResponse.json(
        { error: 'Could not check the existing song library.' },
        { status: 500 }
      );
    }

    const existingSongs = (existingData ?? []) as ExistingSongForImport[];
    const preview = buildSongImportPreview(parseResult, existingSongs);

    if (mode === 'preview') {
      return NextResponse.json({
        summary: preview.summary,
        rows: preview.rows,
        errors: preview.errors,
      });
    }

    const newRows = preview.rows.filter((row) => row.status === 'new');
    const duplicateRows = preview.rows.filter(
      (row) => row.status === 'duplicate'
    );

    let added = 0;
    let updated = 0;
    let skipped = 0;
    // Invalid rows are failures from the caller's point of view: they asked to
    // import every row and these could not be imported.
    let failed = preview.errors.length;
    const errors: SongCsvRowError[] = [...preview.errors];

    if (newRows.length > 0) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('songs')
        .insert(newRows.map((row) => insertPayload(row, user.church_id)))
        .select('id');

      if (insertError) {
        console.error('[API] Song CSV insert error:', insertError);
        return NextResponse.json(
          { error: 'Could not import songs. Please try again.' },
          { status: 500 }
        );
      }

      added = Array.isArray(inserted) ? inserted.length : 0;
      if (added < newRows.length) {
        failed += newRows.length - added;
        for (const row of newRows.slice(added)) {
          errors.push({
            rowNumber: row.rowNumber,
            message: 'Could not add this song.',
          });
        }
      }
    }

    for (const row of duplicateRows) {
      // Only library matches have a song row to update; duplicates of an
      // earlier row in this same file are left alone.
      if (
        !updateExisting ||
        row.matchSource !== 'library' ||
        !row.matchedSongId
      ) {
        skipped += 1;
        continue;
      }

      // Explicit allow-list. Chord charts and other song_files are never
      // touched by an import.
      const updates: SongUpdatePayload = {};
      if (row.defaultKey) updates.default_key = row.defaultKey;
      if (row.ccliNumber) updates.ccli_number = row.ccliNumber;
      if (row.tags.length > 0) updates.tags = row.tags;

      if (Object.keys(updates).length === 0) {
        skipped += 1;
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('songs')
        .update(updates)
        .eq('id', row.matchedSongId)
        .eq('church_id', user.church_id);

      if (updateError) {
        failed += 1;
        errors.push({
          rowNumber: row.rowNumber,
          message: 'Could not update this existing song.',
        });
      } else {
        updated += 1;
      }
    }

    return NextResponse.json({
      summary: {
        added,
        updated,
        skipped,
        failed,
        totalRows: preview.summary.totalRows,
        invalidCount: preview.summary.invalidCount,
      },
      errors,
    });
  } catch (error) {
    console.error('[API] Song CSV import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
