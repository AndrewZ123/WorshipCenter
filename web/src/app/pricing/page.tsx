import { Navbar } from '@/components/nav/Navbar';
import { Footer } from '@/components/footer/Footer';
import { PricingCard } from '@/components/pricing/PricingCard';
import { FAQ } from '@/components/pricing/FAQ';

export const metadata = {
  title: 'Pricing — WorshipCenter',
  description: 'Simple, honest pricing for WorshipCenter. Everything included for one flat rate.',
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-brand-50/50 to-white">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">
              Simple, honest pricing.
            </h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Everything included. No modules. No per-user fees. No surprises.
            </p>
          </div>
        </section>

        {/* Pricing Card */}
        <PricingCard />

        {/* FAQ */}
        <FAQ />
      </main>
      <Footer />
    </>
  );
}