import { Navbar } from '@/components/nav/Navbar';
import { Footer } from '@/components/footer/Footer';
import { Hero } from '@/components/home/Hero';
import { TrustBadges } from '@/components/home/TrustBadges';
import { PainPoints } from '@/components/home/PainPoints';
import { Features } from '@/components/home/Features';
import { DemoCallout } from '@/components/home/DemoCallout';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Testimonials } from '@/components/home/Testimonials';
import { RotationSection } from '@/components/home/RotationSection';
import { Pricing } from '@/components/home/Pricing';
import { ClosingCTA } from '@/components/home/ClosingCTA';
import { FloatingCTA } from '@/components/home/FloatingCTA';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TrustBadges />
        <PainPoints />
        <Features />
        <DemoCallout />
        <HowItWorks />
        <Testimonials />
        <RotationSection />
        <Pricing />
        <ClosingCTA />
      </main>
      <Footer />
      <FloatingCTA />
    </>
  );
}