'use client';

import { useEffect, useRef } from 'react';

type AdSize = 'leaderboard' | 'rectangle' | 'mobile-banner' | 'adhesion';

const SIZE_CLASSES: Record<AdSize, string> = {
  leaderboard: 'ad-slot-leaderboard',
  rectangle: 'ad-slot-rectangle',
  'mobile-banner': 'ad-slot-mobile-banner',
  adhesion: 'ad-slot-adhesion',
};

const AD_FORMATS: Record<AdSize, { width: number; height: number }> = {
  leaderboard: { width: 728, height: 90 },
  rectangle: { width: 300, height: 250 },
  'mobile-banner': { width: 320, height: 50 },
  adhesion: { width: 320, height: 50 },
};

export function AdSlot({
  id,
  size,
  className = '',
}: {
  id: string;
  size: AdSize;
  className?: string;
}) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded or ad blocker active
    }
  }, []);

  const format = AD_FORMATS[size];

  return (
    <div
      className={`mx-auto flex items-center justify-center ${SIZE_CLASSES[size]} ${className}`}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: format.width, height: format.height }}
        data-ad-client="ca-pub-6421284949564984"
        data-ad-slot={id}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
