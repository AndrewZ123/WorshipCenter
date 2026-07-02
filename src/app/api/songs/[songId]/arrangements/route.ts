import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';

// GET /api/songs/[songId]/arrangements - List all arrangements for a song
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
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, key, tempo, time_signature } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Arrangement name is required' }, { status: 400 });
    }

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
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { arrangementId, ...updates } = body as { arrangementId: string; [key: string]: unknown };

    if (!arrangementId) {
      return NextResponse.json({ error: 'Arrangement ID required' }, { status: 400 });
    }

    const arrangement = await db.songArrangements.update(
      arrangementId,
      user.church_id,
      updates as Partial<import('@/lib/types').SongArrangement>
    );

    return NextResponse.json({ arrangement });
  } catch (error) {
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
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { arrangementId } = await req.json();

    const success = await db.songArrangements.delete(arrangementId, user.church_id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete arrangement' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Song arrangement DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}