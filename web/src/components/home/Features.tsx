'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const features = [
  {
    icon: '📅',
    title: 'Service Planner',
    description:
      'Build your complete order of service — songs, segments, prayer, communion — in minutes. Drag to reorder. Duplicate last week. Done.',
  },
  {
    icon: '🎵',
    title: 'Song Library',
    description:
      "Store every song your church uses with keys, chord charts, tags, and usage history. See what you're overplaying before Sunday tells you.",
  },
  {
    icon: '👥',
    title: 'Team Scheduling',
    description:
      "Assign your musicians and techs to each service. They get an email, tap Confirm or Decline, and you see it instantly — no chasing.",
  },
  {
    icon: '📊',
    title: 'CCLI Reporting',
    description:
      'Every completed service automatically logs your songs. When your CCLI reporting period ends, export a CSV and you\'re done.',
  },
];

export function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="features" ref={ref} className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-sm font-semibold uppercase tracking-wider text-brand-600"
          >
            Everything You Need
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-4 text-3xl sm:text-4xl font-bold text-slate-900"
          >
            One app. Every Sunday.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-4 text-lg text-slate-600"
          >
            WorshipCenter replaces the spreadsheets, group texts, and sticky notes with one clean workspace.
          </motion.p>
        </div>

        {/* Feature grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 hover:shadow-md transition-shadow"
            >
              <div className="w-14 h-14 bg-brand-100 rounded-full flex items-center justify-center text-3xl">
                {feature.icon}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-3 text-slate-600 leading-relaxed">
                {feature.description}
              </p>
              <button className="mt-4 text-brand-600 font-medium inline-flex items-center gap-1 hover:text-brand-700 transition-colors">
                Learn more
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}