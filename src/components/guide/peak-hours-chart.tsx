'use client';

import type { HourlyAverage } from '@/lib/db/d1';
import { getWaitSeverity } from '@/lib/utils/colors';

const SEVERITY_BG: Record<string, string> = {
  low: 'bg-green-500',
  moderate: 'bg-yellow-500',
  high: 'bg-orange-500',
  severe: 'bg-red-500',
};

export function PeakHoursChart({ data }: { data: HourlyAverage[] }) {
  if (data.length === 0) return null;

  const maxWait = Math.max(...data.map((d) => d.avg_wait), 1);

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-4 text-sm font-medium text-gray-400 dark:text-gray-500">
        Average Wait by Hour of Day
      </h3>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {Array.from({ length: 24 }, (_, hour) => {
          const entry = data.find((d) => d.hour === hour);
          const wait = entry?.avg_wait ?? 0;
          const pct = maxWait > 0 ? (wait / maxWait) * 100 : 0;
          const severity = getWaitSeverity(wait);

          return (
            <div key={hour} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${SEVERITY_BG[severity]} opacity-80 transition-all`}
                style={{ height: `${Math.max(pct, 2)}%` }}
                title={`${hour}:00 — ${wait}m avg`}
              />
              {hour % 3 === 0 && (
                <span className="text-[9px] text-gray-500">
                  {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
