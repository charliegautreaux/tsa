type AdSize = 'leaderboard' | 'rectangle' | 'mobile-banner' | 'adhesion';

const SIZE_CLASSES: Record<AdSize, string> = {
  leaderboard: 'ad-slot-leaderboard',
  rectangle: 'ad-slot-rectangle',
  'mobile-banner': 'ad-slot-mobile-banner',
  adhesion: 'ad-slot-adhesion',
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
  return (
    <div
      id={id}
      data-ad-slot={id}
      className={`mx-auto flex items-center justify-center ${SIZE_CLASSES[size]} ${className}`}
    >
      {/* Ad network script fills this container */}
    </div>
  );
}
