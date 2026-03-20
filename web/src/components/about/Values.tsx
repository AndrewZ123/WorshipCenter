'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const values = [
  {
    title: 'The choosing is always yours.',
    description:
      "We'll never suggest your setlist or replace your discernment. WorshipCenter handles logistics so you can focus on worship.",
  },
  {
    title: 'Simple enough for every church.',
    description:
      "We designed this for small and mid-size churches who can't afford or don't need a complex ChMS.",
  },
  {
    title: 'Made with the church in mind.',
    description:
      'Every feature was designed with the weekly rhythms of a real worship team in mind.',
  },
];

export function Values() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-3xl sm:text-4xl font-bold text-slate-900"
          >
            Our Values
          </motion.h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center"
            >
              <h3 className="text-xl font-semibold text-slate-900">
                {value.title}
              </h3>
              <p className="mt-3 text-slate-600">{value.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}