import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';

// GET /api/songs/[songId]/versions - List all versions for a song
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { snapshot, changeDescription } = body as {
      snapshot: Record<string, unknown>;
      changeDescription?: string;
    };

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot data is required' }, { status: 400 });
    }

    const version = await db.songVersions.create({
      song_id: songId,
      version_number: 0, // overridden in store (auto-increments)
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
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { versionNumber } = body as { versionNumber: number };

    if (!versionNumber) {
      return NextResponse.json({ error: 'Version number is required' }, { status: 400 });
    }

    const result = await db.songVersions.restore(songId, versionNumber, user.church_id);
    if (!result) {
      return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 });
    }

    return NextResponse.json({ success: true, song: result });
  } catch (error) {
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
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { versionId } = await req.json();

    const success = await db.songVersions.delete(versionId, user.church_id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete version' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Song version DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}