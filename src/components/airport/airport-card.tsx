import Link from "next/link";
import { Sparkline } from "@/components/shared/sparkline";
import { TrendArrow } from "@/components/shared/trend-arrow";
import { DataTierBadge } from "@/components/shared/data-tier-badge";
import { getWaitSeverity } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";
import type { AirportOverview } from "@/lib/types/airport";

const SEVERITY_TEXT: Record<string, string> = {
  low: "text-green-600 dark:text-green-400",
  moderate: "text-yellow-600 dark:text-yellow-400",
  high: "text-orange-600 dark:text-orange-400",
  severe: "text-red-600 dark:text-red-400",
};

const GLOW_MAP: Record<string, string> = {
  low: "glow-green",
  moderate: "glow-yellow",
  high: "glow-orange",
  severe: "glow-red",
};

export function AirportCard({
  airport,
  sparklineData,
}: {
  airport: AirportOverview;
  sparklineData?: number[];
}) {
  const hasWait = airport.worst_wait != null;
  const severity = getWaitSeverity(airport.worst_wait ?? 0);

  return (
    <Link
      href={`/airports/${airport.iata}`}
      className={cn(
        "glass rounded-2xl",
        hasWait && GLOW_MAP[severity],
        "group relative flex flex-col overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold tracking-tight">{airport.iata}</h3>
            <DataTierBadge tier={airport.data_tier} />
          </div>
          <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
            {airport.city}, {airport.state}
          </p>
        </div>
        {hasWait ? (
          <div className="flex-shrink-0 text-right">
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-3xl font-bold tabular-nums tracking-tight",
                  SEVERITY_TEXT[severity]
                )}
              >
                {Math.round(airport.worst_wait!)}
              </span>
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                min
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-end gap-1">
              <TrendArrow trend={airport.worst_trend} />
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-300 dark:text-gray-600">
            No data
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div className="mt-3 px-5">
        {sparklineData && sparklineData.length >= 2 ? (
          <Sparkline
            data={sparklineData}
            id={airport.iata}
            className="h-14 w-full"
          />
        ) : (
          <div className="flex h-14 items-center">
            <div className="h-px w-full bg-gray-100 dark:bg-white/[0.04]" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between px-5 py-3.5 text-xs text-gray-400 dark:text-gray-500">
        <span className="truncate pr-2">{airport.name}</span>
        <span className="flex-shrink-0 text-blue-500 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
          Details &rarr;
        </span>
      </div>
    </Link>
  );
}
