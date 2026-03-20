'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const rotationStatuses = [
  {
    color: 'green',
    emoji: '🟢',
    label: 'Fresh',
    description: 'Not used in 6+ weeks',
  },
  {
    color: 'yellow',
    emoji: '🟡',
    label: 'Healthy',
    description: 'Used once or twice recently',
  },
  {
    color: 'red',
    emoji: '🔴',
    label: 'Overplayed',
    description: 'Used 5+ times in the last 8 weeks',
  },
];

export function RotationSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-3xl sm:text-4xl font-bold text-slate-900"
          >
            Stop playing the same 8 songs.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-4 text-lg text-slate-600"
          >
            WorshipCenter quietly tracks when each song was last used so you can see your rotation at a glance — and rediscover songs your congregation loves.
          </motion.p>
        </div>

        {/* Rotation badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-12 flex flex-wrap justify-center gap-6"
        >
          {rotationStatuses.map((status) => (
            <div
              key={status.label}
              className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-4 flex items-center gap-4"
            >
              <span className="text-2xl">{status.emoji}</span>
              <div>
                <div className="font-semibold text-slate-900">{status.label}</div>
                <div className="text-sm text-slate-500">{status.description}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Integrity message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-12 text-center text-slate-500 italic"
        >
          You still choose every song. WorshipCenter just helps you choose well.
        </motion.p>
      </div>
    </section>
  );
}