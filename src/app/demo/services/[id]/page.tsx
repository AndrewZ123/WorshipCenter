import ServiceDetailClient from './ClientPage';

// Demo service IDs for static generation
const DEMO_SERVICE_IDS = ['svc-1', 'svc-2', 'svc-3', 'svc-4'];

// Generate static params for static export
export function generateStaticParams() {
  return DEMO_SERVICE_IDS.map(id => ({ id }));
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceDetailClient />;
}