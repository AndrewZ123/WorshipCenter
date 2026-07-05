const DEMO_TEMPLATE_IDS = ['tpl-1', 'tpl-2'];

export function generateStaticParams() {
  return DEMO_TEMPLATE_IDS.map(id => ({ id }));
}

export default function DemoTemplateDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
