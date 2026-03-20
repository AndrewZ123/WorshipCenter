'use client';

import { motion } from 'framer-motion';
import { APP_URL, DEMO_URL } from '@/lib/constants';

const features = [
  'Unlimited services',
  'Unlimited songs + chord chart uploads',
  'Unlimited team members',
  'Team scheduling + email confirmations',
  'Song rotation tracking',
  'CCLI usage log + CSV export',
  'Service templates',
  'Mobile app (iOS + Android)',
  'Dark mode',
  'Priority support',
];

export function PricingCard() {
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8"
        >
          {/* Price */}
          <div className="text-center">
            <div className="text-5xl font-bold text-slate-900">$29</div>
            <div className="text-slate-600 mt-1">/ month</div>
            <p className="text-sm text-slate-500 mt-2">
              or $290/year (save 2 months)
            </p>
          </div>

          {/* Trial info */}
          <div className="mt-6 text-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-100 text-brand-700">
              14-day free trial. No credit card required.
            </span>
          </div>

          {/* Features */}
          <ul className="mt-8 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-slate-600">{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <a
            href={`${APP_URL}/signup`}
            className="mt-8 block w-full bg-brand-600 text-white text-center px-6 py-3 rounded-lg font-semibold hover:bg-brand-700 transition-colors shadow-sm"
          >
            Start Free — 2 Sundays On Us
          </a>

          {/* Demo link */}
          <div className="mt-4 text-center">
            <span className="text-slate-500 text-sm">— or —</span>
            <a
              href={DEMO_URL}
              className="mt-2 block text-slate-500 hover:text-brand-600 text-sm font-medium transition-colors"
            >
              Explore the Demo First →
            </a>
          </div>

          {/* Contact */}
          <p className="mt-4 text-center text-sm text-slate-500">
            Have questions?{' '}
            <a href="mailto:hello@worshipcenter.app" className="text-brand-600 hover:text-brand-700">
              Contact us
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}