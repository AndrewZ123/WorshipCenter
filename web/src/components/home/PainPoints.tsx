'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const painPoints = [
  {
    icon: '💬',
    title: 'Texting your team every single week',
    description:
      "Chasing confirmations via group text, email, and DMs — and still not knowing who's showing up Sunday morning.",
  },
  {
    icon: '🎵',
    title: 'Guessing when you last played a song',
    description:
      'Playing the same 8 songs on rotation without realizing it, or forgetting a congregation favorite for months.',
  },
  {
    icon: '📋',
    title: 'Scrambling before every Sunday',
    description:
      "Last-minute chord chart requests, no pastor-worship alignment, and a service order that lives in your head.",
  },
];

export function PainPoints() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Section label */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center text-sm font-semibold uppercase tracking-wider text-brand-600"
        >
          Sound Familiar?
        </motion.p>

        {/* Cards */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {painPoints.map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-2xl">
                {point.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {point.title}
              </h3>
              <p className="mt-2 text-slate-600">{point.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}