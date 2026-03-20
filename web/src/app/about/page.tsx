import { Navbar } from '@/components/nav/Navbar';
import { Footer } from '@/components/footer/Footer';
import { FounderStory } from '@/components/about/FounderStory';
import { Values } from '@/components/about/Values';
import { AboutCTA } from '@/components/about/AboutCTA';

export const metadata = {
  title: 'About — WorshipCenter',
  description: 'Built by a worship leader, for worship leaders. Learn the story behind WorshipCenter.',
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-brand-50/50 to-white">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">
              Built by a worship leader,
              <br />
              <span className="text-brand-600">for worship leaders.</span>
            </h1>
          </div>
        </section>

        {/* Founder Story */}
        <FounderStory />

        {/* Values */}
        <Values />

        {/* CTA */}
        <AboutCTA />
      </main>
      <Footer />
    </>
  );
}