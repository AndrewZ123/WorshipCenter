const DEMO_SERVICE_IDS = ['svc-1', 'svc-2', 'svc-3', 'svc-4'];

export function generateStaticParams() {
  return DEMO_SERVICE_IDS.map(id => ({ id }));
}

export default function DemoServiceDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
