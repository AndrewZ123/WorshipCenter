'use client';

import { useEffect } from 'react';
import { isCapacitorNative } from '@/lib/api-base';

export function useKeyboard() {
  useEffect(() => {
    if (isCapacitorNative()) return;
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    if (!vv) return;

    const detect = () => {
      const visible = vv.height;
      const full = window.innerHeight;
      const keyboardHeight = Math.max(0, full - visible);
      const isVisible = keyboardHeight > 150;

      if (isVisible) {
        document.documentElement.style.setProperty('--viewport-height', `${visible}px`);
        document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
        document.body.classList.add('keyboard-visible');

        requestAnimationFrame(() => {
          const inputArea = document.querySelector<HTMLElement>('.chat-input-area');
          if (inputArea) {
            inputArea.scrollIntoView({ block: 'nearest' });
          }
        });
      } else {
        document.documentElement.style.removeProperty('--viewport-height');
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.body.classList.remove('keyboard-visible');
      }
    };

    vv.addEventListener('resize', detect);
    vv.addEventListener('scroll', detect);

    detect();

    return () => {
      vv.removeEventListener('resize', detect);
      vv.removeEventListener('scroll', detect);
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.removeProperty('--viewport-height');
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    };
  }, []);
}
