import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { db } from '@/lib/store';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { SongParamsSchema, invalidInputResponse } from '@/lib/validation';
import { z } from 'zod';

// GET /api/songs/[songId]/arrangements - List all arrangements for a song
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `songs-arrangements-read:${user.id}`,
      RateLimitTiers.API_READ.requests,
      RateLimitTiers.API_READ.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const subscriptionCheck = await requireActiveSubscription(req);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    const paramsResult = SongParamsSchema.safeParse(await params);
    if (!paramsResult.success) {
      return invalidInputResponse();
    }
    const { songId } = paramsResult.data;

    const arrangements = await db.songArrangements.getBySong(songId, user.church_id);
    return NextResponse.json({ arrangements });
  } catch (error) {
    console.error('[API] Song arrangements GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/songs/[songId]/arrangements - Create a new arrangement
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `songs-arrangements-write:${user.id}`,
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

    const paramsResult = SongParamsSchema.safeParse(await params);
    if (!paramsResult.success) {
      return invalidInputResponse();
    }
    const { songId } = paramsResult.data;

    // Verify song belongs to user's church
    const song = await db.songs.getById(songId, user.church_id);
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const CreateArrangementSchema = z.object({
      name: z.string().min(1, 'Arrangement name is required').max(200),
      key: z.string().max(20).optional().default(''),
      tempo: z.number().int().min(20).max(300).nullable().optional().default(null),
      time_signature: z.enum(['2/4', '3/4', '4/4', '6/8', '5/4', '7/8']).optional().default('4/4'),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return invalidInputResponse();
    }

    const parsedBody = CreateArrangementSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { name, key, tempo, time_signature } = parsedBody.data;

    const arrangement = await db.songArrangements.create({
      song_id: songId,
      church_id: user.church_id,
      name: name.trim(),
      key: key || '',
      tempo: tempo || null,
      time_signature: time_signature || '4/4',
      structure: [],
      notes: null,
      is_default: false,
      created_by: user.id,
    });

    return NextResponse.json({ arrangement });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[API] Song arrangement POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/songs/[songId]/arrangements - Update an arrangement
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `songs-arrangements-write:${user.id}`,
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

    const paramsResult = SongParamsSchema.safeParse(await params);
    if (!paramsResult.success) {
      return invalidInputResponse();
    }

    const UpdateArrangementSchema = z.object({
      arrangementId: z.string().uuid('Invalid arrangement ID'),
      name: z.string().min(1).max(200).optional(),
      key: z.string().max(20).optional(),
      tempo: z.number().int().min(20).max(300).nullable().optional(),
      time_signature: z.enum(['2/4', '3/4', '4/4', '6/8', '5/4', '7/8']).optional(),
      notes: z.string().max(5000).nullable().optional(),
      is_default: z.boolean().optional(),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return invalidInputResponse();
    }

    const parsedBody = UpdateArrangementSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { arrangementId, ...updates } = parsedBody.data;

    const arrangement = await db.songArrangements.update(
      arrangementId,
      user.church_id,
      updates as Partial<import('@/lib/types').SongArrangement>
    );

    return NextResponse.json({ arrangement });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[API] Song arrangement PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/songs/[songId]/arrangements - Delete an arrangement
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `songs-arrangements-write:${user.id}`,
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

    const paramsResult = SongParamsSchema.safeParse(await params);
    if (!paramsResult.success) {
      return invalidInputResponse();
    }

    const DeleteArrangementSchema = z.object({
      arrangementId: z.string().uuid('Invalid arrangement ID'),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return invalidInputResponse();
    }

    const parsedBody = DeleteArrangementSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { arrangementId } = parsedBody.data;

    const success = await db.songArrangements.delete(arrangementId, user.church_id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete arrangement' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[API] Song arrangement DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}