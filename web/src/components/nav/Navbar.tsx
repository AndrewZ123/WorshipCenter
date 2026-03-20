'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_URL, DEMO_URL } from '@/lib/constants';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/80 backdrop-blur-lg border-b border-slate-200'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-xl font-semibold">
              <span className="text-slate-900">Worship</span>
              <span className="text-brand-600">Center</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              About
            </Link>
            <a
              href={DEMO_URL}
              className="text-brand-600 hover:text-brand-700 font-medium transition-colors flex items-center gap-1"
            >
              <span>▶</span> Live Demo
            </a>
            <a
              href={`${APP_URL}/login`}
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              Login
            </a>
            <a
              href={`${APP_URL}/signup`}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-700 transition-colors shadow-sm"
            >
              Start Free Trial
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white border-b border-slate-200"
          >
            <div className="px-4 py-4 space-y-3">
              <Link
                href="/pricing"
                className="block text-slate-600 hover:text-slate-900 font-medium py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/about"
                className="block text-slate-600 hover:text-slate-900 font-medium py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>
              <a
                href={DEMO_URL}
                className="block text-brand-600 hover:text-brand-700 font-medium py-2 flex items-center gap-1"
              >
                <span>▶</span> Live Demo
              </a>
              <a
                href={`${APP_URL}/login`}
                className="block text-slate-600 hover:text-slate-900 font-medium py-2"
              >
                Login
              </a>
              <a
                href={`${APP_URL}/signup`}
                className="block bg-brand-600 text-white text-center px-4 py-3 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
              >
                Start Free Trial
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}