import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';

interface GiphyGif {
  id: string;
  title: string;
  images?: {
    original?: { url?: string; width?: string; height?: string };
    fixed_width?: { url?: string; width?: string; height?: string };
  };
}

const GIPHY_API_KEY = process.env.GIPHY_API_KEY || process.env.NEXT_PUBLIC_GIPHY_API_KEY;

export async function GET(request: NextRequest) {
  // GIF search is a paid upstream API — rate limit before doing any work.
  const limit = checkRateLimit(`chat-giphy:${getClientIp(request)}`, 60, 60 * 1000);
  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subscriptionCheck = await requireActiveSubscription(request);
  if (subscriptionCheck !== true) {
    return subscriptionCheck;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  if (!q || !q.trim()) {
    return NextResponse.json({ results: [] });
  }

  if (!GIPHY_API_KEY) {
    // Return empty results in development if no key configured
    return NextResponse.json({ results: [], error: 'GIPHY API key not configured' });
  }

  try {
    const url = new URL('https://api.giphy.com/v1/gifs/search');
    url.searchParams.set('api_key', GIPHY_API_KEY);
    url.searchParams.set('q', q.trim());
    url.searchParams.set('limit', '20');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('rating', 'g');
    url.searchParams.set('lang', 'en');

    const response = await fetch(url.toString());
    const data = await response.json();

    const results = (data.data || []).map((gif: GiphyGif) => ({
      id: gif.id,
      title: gif.title,
      url: gif.images?.original?.url || '',
      previewUrl: gif.images?.fixed_width?.url || '',
      width: gif.images?.original?.width || null,
      height: gif.images?.original?.height || null,
      previewWidth: gif.images?.fixed_width?.width || null,
      previewHeight: gif.images?.fixed_width?.height || null,
    }));

    return NextResponse.json({ results, total: data.pagination?.total_count || 0 });
  } catch (error) {
    console.error('[GIPHY] Search failed:', error);
    return NextResponse.json({ results: [], error: 'Search failed' }, { status: 500 });
  }
}
