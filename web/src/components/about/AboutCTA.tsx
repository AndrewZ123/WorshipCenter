'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { APP_URL } from '@/lib/constants';

export function AboutCTA() {
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
            Try WorshipCenter free for 30 days.
          </h2>
          <p className="mt-4 text-lg text-brand-100 max-w-2xl mx-auto">
            Join worship teams who've replaced the chaos with a simple, beautiful planning tool.
          </p>
          <a
            href={`${APP_URL}/signup`}
            className="mt-8 inline-block bg-white text-brand-600 px-8 py-3 rounded-lg font-semibold hover:bg-brand-50 transition-colors shadow-lg"
          >
            Start Free — 30 Days on Us
          </a>
        </motion.div>
      </div>
    </section>
  );
}