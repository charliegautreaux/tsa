import Link from "next/link";
import { WaitBadge } from "@/components/shared/wait-badge";
import { TrendArrow } from "@/components/shared/trend-arrow";
import { DataTierBadge } from "@/components/shared/data-tier-badge";
import { getWaitSeverity } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";
import type { AirportOverview } from "@/lib/types/airport";

const borderColors: Record<string, string> = {
  low: "border-l-green-500",
  moderate: "border-l-yellow-500",
  high: "border-l-orange-500",
  severe: "border-l-red-500",
};

export function AirportCard({ airport }: { airport: AirportOverview }) {
  const severity = getWaitSeverity(airport.worst_wait ?? 0);

  return (
    <Link
      href={`/airports/${airport.iata}`}
      className={cn(
        "group block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900",
        "border-l-4",
        borderColors[severity]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold tabular-nums tracking-tight">
            {airport.iata}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {airport.city}, {airport.state}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <WaitBadge minutes={airport.worst_wait} size="lg" />
          <TrendArrow trend={airport.worst_trend} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
          {airport.name}
        </p>
        <DataTierBadge tier={airport.data_tier} />
      </div>
    </Link>
  );
}
