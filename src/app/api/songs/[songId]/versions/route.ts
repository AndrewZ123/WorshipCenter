import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { db } from '@/lib/store';
import { SongParamsSchema, invalidInputResponse } from '@/lib/validation';
import { z } from 'zod';

// GET /api/songs/[songId]/versions - List all versions for a song
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const versions = await db.songVersions.getBySong(songId, user.church_id);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error('[API] Song versions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/songs/[songId]/versions - Create a new version (snapshot) of a song
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const CreateVersionSchema = z.object({
      snapshot: z.object({}).passthrough(),
      changeDescription: z.string().max(5000).optional(),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return invalidInputResponse();
    }

    const parsedBody = CreateVersionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { snapshot, changeDescription } = parsedBody.data;

    const version = await db.songVersions.create({
      song_id: songId,
      version_number: 0,
      church_id: user.church_id,
      title: (snapshot.title as string) || '',
      artist: (snapshot.artist as string) || null,
      default_key: (snapshot.default_key as string) || (snapshot.key as string) || null,
      ccli_number: (snapshot.ccli_number as string) || null,
      tags: (snapshot.tags as string[]) || [],
      notes: changeDescription || (snapshot.notes as string) || null,
      created_by: user.id,
    });

    return NextResponse.json({ version });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[API] Song version POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/songs/[songId]/versions - Restore a previous version
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const RestoreVersionSchema = z.object({
      versionNumber: z.number().int().positive('Version number is required'),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return invalidInputResponse();
    }

    const parsedBody = RestoreVersionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { versionNumber } = parsedBody.data;

    const result = await db.songVersions.restore(songId, versionNumber, user.church_id);
    if (!result) {
      return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 });
    }

    return NextResponse.json({ success: true, song: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[API] Song version restore error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/songs/[songId]/versions - Delete a version
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionCheck = await requireActiveSubscription(req);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    const paramsResult = SongParamsSchema.safeParse(await params);
    if (!paramsResult.success) {
      return invalidInputResponse();
    }

    const DeleteVersionSchema = z.object({
      versionId: z.string().uuid('Invalid version ID'),
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return invalidInputResponse();
    }

    const parsedBody = DeleteVersionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { versionId } = parsedBody.data;

    const success = await db.songVersions.delete(versionId, user.church_id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete version' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[API] Song version DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}