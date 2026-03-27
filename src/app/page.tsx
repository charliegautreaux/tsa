import { AirportCard } from "@/components/airport/airport-card";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getAirportOverview,
  getNationalStats,
  getSparklineData,
} from "@/lib/db/d1";
import { Plane, Clock, Shield, AlertTriangle } from "lucide-react";
import { getWaitSeverity } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

const SEVERITY_TEXT: Record<string, string> = {
  low: "text-green-600 dark:text-green-400",
  moderate: "text-yellow-600 dark:text-yellow-400",
  high: "text-orange-600 dark:text-orange-400",
  severe: "text-red-600 dark:text-red-400",
};

export default async function Home() {
  const { env } = await getCloudflareContext();

  const [airports, stats, sparklines] = await Promise.all([
    getAirportOverview(env.DB),
    getNationalStats(env.DB),
    getSparklineData(env.DB),
  ]);

  const sparklineMap = new Map<string, number[]>();
  for (const row of sparklines) {
    const arr = sparklineMap.get(row.airport_code) ?? [];
    arr.push(row.wait_minutes);
    sparklineMap.set(row.airport_code, arr);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="gradient-text text-4xl font-bold tracking-tight sm:text-5xl">
          TSA Wait Times
        </h1>
        <p className="mt-3 text-gray-500 dark:text-gray-400">
          Live security checkpoint data across US airports
        </p>
      </div>

      {/* Stats */}
      <div className="stagger mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Plane className="h-4 w-4" />}
          label="Airports Live"
          value={String(stats.airports_with_data)}
          sub={`of ${stats.total_airports}`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Avg Standard"
          value={`${stats.avg_wait_standard}m`}
          colorClass={SEVERITY_TEXT[getWaitSeverity(stats.avg_wait_standard)]}
        />
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          label="Avg Pre✓"
          value={`${stats.avg_wait_precheck}m`}
          colorClass={SEVERITY_TEXT[getWaitSeverity(stats.avg_wait_precheck)]}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Longest Now"
          value={`${Math.round(stats.worst_wait)}m`}
          sub={stats.worst_airport_code ?? undefined}
          colorClass={SEVERITY_TEXT[getWaitSeverity(stats.worst_wait)]}
        />
      </div>

      {/* Airport Grid */}
      {airports.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-2xl py-20 text-gray-400">
          <Plane className="mb-3 h-8 w-8" />
          <p className="text-lg font-medium">No airport data available yet</p>
          <p className="mt-1 text-sm">
            Wait times will appear once data feeds start.
          </p>
        </div>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {airports.map((airport) => (
            <AirportCard
              key={airport.iata}
              airport={airport}
              sparklineData={sparklineMap.get(airport.iata)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="glass rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-bold tabular-nums", colorClass)}>
          {value}
        </span>
        {sub && <span className="text-xs text-gray-400 dark:text-gray-500">{sub}</span>}
      </div>
    </div>
  );
}
