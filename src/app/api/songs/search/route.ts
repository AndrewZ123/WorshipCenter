import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { db } from '@/lib/store';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { SongSearchQuerySchema, invalidInputResponse } from '@/lib/validation';

// GET /api/songs/search?q=<query>&tags=tag1,tag2&key=C&artist=...&limit=20
export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(
      `songs-search:${user.id}`,
      RateLimitTiers.API_READ.requests,
      RateLimitTiers.API_READ.window
    );
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const subscriptionCheck = await requireActiveSubscription(req);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    const { searchParams } = new URL(req.url);
    const parsedQuery = SongSearchQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );
    if (!parsedQuery.success) {
      return invalidInputResponse();
    }

    const { q: query, tags: tagsParam, key, artist, limit } = parsedQuery.data;
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