'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const steps = [
  {
    number: '01',
    title: 'Plan the service',
    description:
      'Build your order of service, pick songs from your library, and attach the sermon brief from your pastor.',
  },
  {
    number: '02',
    title: 'Schedule your team',
    description:
      'Assign musicians and techs to each service. They get an email invite and confirm with one click.',
  },
  {
    number: '03',
    title: 'Run Sunday. Log it.',
    description:
      'Mark the service complete and your song usage is automatically logged for CCLI reporting.',
  },
];

export function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-3xl sm:text-4xl font-bold text-slate-900"
          >
            Sunday sorted in three steps.
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="relative"
            >
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 h-full">
                <span className="text-5xl font-bold text-brand-200">
                  {step.number}
                </span>
                <h3 className="mt-4 text-xl font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-slate-600">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}