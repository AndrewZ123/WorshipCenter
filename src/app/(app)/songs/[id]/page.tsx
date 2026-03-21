import SongDetailClient from './SongDetailClient';

// generateStaticParams only for static export (Capacitor builds)
// For production SSR (Vercel), dynamic routes are handled at runtime
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  // Only generate static params for static export builds
  if (process.env.STATIC_EXPORT === 'true') {
    // For static export with client-side data fetching, provide a fallback ID
    // The actual component will handle dynamic routing at runtime
    return [{ id: '__fallback__' }];
  }
  // For SSR, return empty array to let dynamic routes handle it
  return [];
}

export default function SongDetailPage() {
  return <SongDetailClient />;
}
