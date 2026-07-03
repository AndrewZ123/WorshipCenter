const DEMO_MEMBER_IDS = ['member-1', 'member-2', 'member-3', 'member-4'];

export function generateStaticParams() {
  return DEMO_MEMBER_IDS.map(id => ({ id }));
}

export default function DemoTeamMemberDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
