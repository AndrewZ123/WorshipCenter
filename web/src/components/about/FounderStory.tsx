'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

export function FounderStory() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Image placeholder */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            <div className="aspect-square bg-gradient-to-br from-brand-100 to-brand-200 rounded-2xl flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-24 h-24 mx-auto mb-4 bg-brand-600 rounded-full flex items-center justify-center">
                  <span className="text-4xl">🎵</span>
                </div>
                <p className="text-brand-700 font-medium">Andrew</p>
                <p className="text-brand-600 text-sm">Founder & Worship Leader</p>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-500/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl" />
          </motion.div>

          {/* Story text */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <p className="text-lg text-slate-600 leading-relaxed">
              I've been leading worship for years. Every Sunday, I was texting my team, reformatting chord charts, and trying to remember the last time we played a particular song. I tried every tool out there — they were either too expensive, too complex, or clearly built by people who'd never stood on a stage on Sunday morning.
            </p>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              So I built WorshipCenter. Not to replace the Holy Spirit in how you pick songs — that's still yours. But to handle the logistics, the scheduling, the history, and the reporting so you can spend your prep time on what actually matters: <span className="font-medium text-slate-900">preparing your heart and your team for Sunday.</span>
            </p>
            <p className="mt-6 text-slate-900 font-medium italic">
              — Andrew, Worship Leader & Founder
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}