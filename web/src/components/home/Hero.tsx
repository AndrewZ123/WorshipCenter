'use client';

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { APP_URL, DEMO_URL } from '@/lib/constants';

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50/50 to-white pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Badge>🎵 Built by a worship leader</Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight"
          >
            Worship planning
            <br />
            <span className="text-brand-600">without the chaos.</span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto"
          >
            Plan services, build setlists, schedule your team, and track song usage — all in one simple place. Try it live with sample data, or start your free 14-day trial today.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button href={`${APP_URL}/signup`} size="lg" className="w-full sm:w-auto">
              Start Free — 2 Sundays On Us
            </Button>
            <Button variant="ghost" size="lg" href={DEMO_URL} className="w-full sm:w-auto">
              See a Live Demo →
            </Button>
          </motion.div>

          {/* Social proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mt-6 text-sm text-slate-500"
          >
            No credit card required · Pre-loaded demo with sample church data
          </motion.p>
        </div>

        {/* App Screenshot Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 relative"
        >
          <div className="relative mx-auto max-w-5xl">
            {/* Browser frame */}
            <div className="bg-slate-900 rounded-t-xl p-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-slate-800 rounded-md px-4 py-1 text-xs text-slate-400">
                  worshipcenter.app
                </div>
              </div>
            </div>
            
            {/* Screenshot placeholder */}
            <div className="bg-gradient-to-b from-slate-100 to-white border border-slate-200 border-t-0 rounded-b-xl p-8 shadow-2xl">
              <div className="aspect-video bg-gradient-to-br from-brand-50 to-brand-100 rounded-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-brand-600 rounded-xl flex items-center justify-center">
                    <span className="text-3xl">🎵</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">WorshipCenter Dashboard</h3>
                  <p className="text-slate-600 mt-2">Your worship planning command center</p>
                </div>
              </div>
            </div>
            
            {/* Gradient fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}