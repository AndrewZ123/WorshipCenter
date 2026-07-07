import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';

// GET /api/songs/search?q=<query>&tags=tag1,tag2&key=C&artist=...&limit=20
export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const tagsParam = searchParams.get('tags');
    const key = searchParams.get('key') || undefined;
    const artist = searchParams.get('artist') || undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined;

    const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;

    const songs = await db.songSearch.search(user.church_id, query, {
      tags,
      key,
      artist,
      limit,
    });

    return NextResponse.json({ songs });
  } catch (error) {
    console.error('[API] Song search GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}