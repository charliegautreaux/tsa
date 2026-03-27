'use client';

import { cn } from '@/lib/utils/cn';
import { MapPin, Loader2 } from 'lucide-react';

export type SortOption = 'wait' | 'nearest' | 'size' | 'az' | 'state';

const SORT_LABELS: Record<SortOption, string> = {
  wait: 'Wait Time',
  nearest: 'Nearest',
  size: 'Size',
  az: 'A-Z',
  state: 'State',
};

const SORT_ORDER: SortOption[] = ['wait', 'nearest', 'size', 'az', 'state'];

export function SortPills({
  active,
  onSort,
  locationLoading,
}: {
  active: SortOption;
  onSort: (sort: SortOption) => void;
  locationLoading: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {SORT_ORDER.map((sort) => (
        <button
          key={sort}
          onClick={() => onSort(sort)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
            active === sort
              ? 'bg-purple-600 text-white'
              : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200'
          )}
        >
          {sort === 'nearest' && locationLoading && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          {sort === 'nearest' && !locationLoading && (
            <MapPin className="h-3 w-3" />
          )}
          {SORT_LABELS[sort]}
        </button>
      ))}
    </div>
  );
}
