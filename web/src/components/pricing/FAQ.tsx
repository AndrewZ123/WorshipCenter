'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEMO_URL } from '@/lib/constants';

const faqs = [
  {
    question: 'Can I try it without signing up at all?',
    answer: (
      <>
        Yes! we have a live interactive demo pre-loaded with sample church data. Browse the service planner, song library, and team scheduler freely with no account required.{' '}
        <a href={DEMO_URL} className="text-brand-600 hover:text-brand-700 font-medium">
          Open the demo →
        </a>
      </>
    ),
  },
  {
    question: 'Is there really no credit card required for the trial?',
    answer: 'Nope. Sign up and get 14 full days — two complete Sundays — to plan services, schedule your team, and see how WorshipCenter fits into your workflow. No card, no commitment.',
  },
  {
    question: 'What happens after the trial?',
    answer: "You'll be prompted to subscribe at $29/month to keep your data. If you choose not to subscribe, your data will be retained for 30 days before being deleted.",
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes, cancel from your account settings at any time. No questions asked, no hidden fees.',
  },
  {
    question: 'How many team members can I add?',
    answer: 'Unlimited. We don\'t charge per seat. Add your entire worship team, tech team, and anyone else who needs access.',
  },
  {
    question: 'Do I need a CCLI license to use WorshipCenter?',
    answer: 'You need your own CCLI license for your church. WorshipCenter helps you track and report usage, but doesn\'t provide the license itself.',
  },
  {
    question: 'Is there a mobile app?',
    answer: 'Yes! WorshipCenter works as a web app on any device, and native iOS/Android apps are available on the App Store and Google Play.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 text-center">
          Frequently Asked Questions
        </h2>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <span className="font-semibold text-slate-900">{faq.question}</span>
                <motion.svg
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-5 h-5 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-4 text-slate-600">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}