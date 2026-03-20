import TeamMemberDetailClient from './ClientPage';

// Demo team member IDs for static generation
const DEMO_MEMBER_IDS = ['member-1', 'member-2', 'member-3', 'member-4'];

// Generate static params for static export
export function generateStaticParams() {
  return DEMO_MEMBER_IDS.map(id => ({ id }));
}

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamMemberDetailClient />;
}