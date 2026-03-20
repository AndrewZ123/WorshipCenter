'use client';

import { motion } from 'framer-motion';
import { DEMO_URL } from '@/lib/constants';

export function DemoCallout() {
  return (
    <section className="bg-brand-600 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-brand-100 text-sm font-semibold uppercase tracking-wider"
          >
            See It Before You Commit
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-4 text-3xl sm:text-4xl font-bold text-white"
          >
            Explore WorshipCenter with real data - no signup needed.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-4 text-lg text-brand-100 max-w-2xl mx-auto"
          >
            The live demo is pre-loaded with a sample church, song library, upcoming services, and a full team roster. Poke around freely. It resets every hour.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left side - Feature list */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="space-y-4"
          >
            {[
              '3 upcoming services pre-planned',
              '45-song library with tags and chord charts',
              'Team scheduling with 8 sample members',
              'Song rotation tracker with health badges',
              'CCLI usage log with export',
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3 text-white">
                <span className="text-brand-200 text-xl">✅</span>
                <span className="text-lg">{feature}</span>
              </div>
            ))}
          </motion.div>

          {/* Right side - CTA button */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="text-center"
          >
            <a
              href={DEMO_URL}
              className="inline-flex items-center gap-2 bg-white text-brand-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-brand-50 transition-colors shadow-lg"
            >
              <span className="text-xl">▶</span>
              Open Live Demo
            </a>
            <p className="mt-4 text-sm text-brand-200">
              No Account Needed!
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}