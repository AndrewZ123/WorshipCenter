'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const testimonials = [
  {
    quote: "I used to spend 3 hours every week texting my team and organizing chord charts. Now it takes 20 minutes. WorshipCenter gave me my Thursday nights back.",
    author: "Michael Torres",
    role: "Worship Pastor",
    church: "Grace Community Church",
    location: "Austin, TX",
  },
  {
    quote: "The song rotation feature alone is worth it. I realized we were playing the same 6 songs on repeat. Now our congregation is experiencing the full richness of our library.",
    author: "Sarah Chen",
    role: "Worship Leader",
    church: "New Life Fellowship",
    location: "Seattle, WA",
  },
  {
    quote: "Finally, a tool built by someone who actually gets it. It's simple enough that my volunteers can use it, but powerful enough to handle everything we need.",
    author: "David Okonkwo",
    role: "Music Director",
    church: "Redeemer City Church",
    location: "Atlanta, GA",
  },
  {
    quote: "CCLI reporting used to be a nightmare. Now I just export a CSV and I'm done. My admin team thinks I'm a wizard.",
    author: "Jennifer Martinez",
    role: "Worship Coordinator",
    church: "Harvest Bible Chapel",
    location: "Denver, CO",
  },
];

export function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-sm font-semibold text-brand-600 uppercase tracking-wide"
          >
            Loved by Worship Leaders
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900"
          >
            Don't just take our word for it
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-4 text-lg text-slate-600"
          >
            Join worship leaders who've simplified their Sunday prep
          </motion.p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8"
            >
              {/* Stars */}
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <p className="mt-4 text-slate-600 leading-relaxed">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="mt-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-semibold">
                  {testimonial.author.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.author}</p>
                  <p className="text-sm text-slate-500">
                    {testimonial.role} • {testimonial.church}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}