'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { APP_URL } from '@/lib/constants';

export function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 500px
      setIsVisible(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-lg py-3 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="font-semibold text-slate-900">Ready to simplify your Sunday prep?</p>
              <p className="text-sm text-slate-500">30-day free trial, no credit card required</p>
            </div>
            <a
              href={`${APP_URL}/signup`}
              className="flex-1 sm:flex-none bg-brand-600 text-white text-center px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors shadow-sm"
            >
              Start Free Trial
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}