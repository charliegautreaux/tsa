'use client';

import { useState, useEffect } from 'react';
import { setConsent, hasConsented } from '@/lib/utils/consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasConsented()) setVisible(true);
  }, []);

  if (!visible) return null;

  function handle(status: 'accepted' | 'rejected') {
    setConsent(status);
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="glass mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl px-5 py-3.5">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          We use cookies for analytics and ads.{' '}
          <a href="/privacy" className="underline hover:text-gray-900 dark:hover:text-white">
            Privacy Policy
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => handle('rejected')}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
          >
            Decline
          </button>
          <button
            onClick={() => handle('accepted')}
            className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
