const DEMO_SONG_IDS = ['song-1', 'song-2', 'song-3', 'song-4', 'song-5', 'song-6'];

export function generateStaticParams() {
  return DEMO_SONG_IDS.map(id => ({ id }));
}

export default function DemoSongDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
