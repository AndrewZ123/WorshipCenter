'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { APP_URL, DEMO_URL } from '@/lib/constants';

export function ClosingCTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-3xl p-8 sm:p-12 text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready for a smoother Sunday?
          </h2>
          <p className="mt-4 text-lg text-brand-100 max-w-2xl mx-auto">
            Join worship teams who've replaced the chaos with WorshipCenter.
          </p>
          <a
            href={`${APP_URL}/signup`}
            className="mt-8 inline-block bg-white text-brand-600 px-8 py-3 rounded-lg font-semibold hover:bg-brand-50 transition-colors shadow-lg"
          >
            Start Free — 2 Sundays On Us
          </a>
          <p className="mt-4 text-sm text-brand-200">
            Not ready to commit?{' '}
            <a href={DEMO_URL} className="underline hover:text-white transition-colors">
              See the app in action
            </a>
            {' '}with live demo data
          </p>
        </motion.div>
      </div>
    </section>
  );
}