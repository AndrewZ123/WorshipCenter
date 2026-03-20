import ServiceDetailClient from './ServiceDetailClient';

export async function generateStaticParams() {
  // For static export with client-side data fetching, provide a fallback ID
  // The actual component will handle dynamic routing at runtime
  return [{ id: '__fallback__' }];
}

export default function ServiceDetailPage() {
  return <ServiceDetailClient />;
}
