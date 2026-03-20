import SongDetailClient from './ClientPage';

// Demo song IDs for static generation
const DEMO_SONG_IDS = ['song-1', 'song-2', 'song-3', 'song-4', 'song-5', 'song-6'];

// Generate static params for static export
export function generateStaticParams() {
  return DEMO_SONG_IDS.map(id => ({ id }));
}

export default async function SongDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SongDetailClient />;
}