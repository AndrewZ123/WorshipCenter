export async function generateStaticParams() {
  if (process.env.STATIC_EXPORT === 'true') {
    return [{ id: '__fallback__' }];
  }
  return [];
}

export default function TeamMemberDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
