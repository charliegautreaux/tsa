import { Sparkline } from "@/components/shared/sparkline";
import { WaitBadge } from "@/components/shared/wait-badge";
import { TrendArrow } from "@/components/shared/trend-arrow";
import type { Trend } from "@/lib/types/reading";

interface LaneData {
  wait_minutes: number;
  trend: Trend;
  confidence: number;
  source: string;
}

interface CheckpointData {
  id: string;
  name: string;
  terminal: string | null;
  status: string;
  lanes: Record<string, LaneData>;
  updated_at: string | null;
}

const laneLabels: Record<string, string> = {
  standard: "Standard",
  precheck: "TSA Pre\u2713",
  clear: "CLEAR",
};

function relativeTime(ts: string): string {
  const then = new Date(ts.replace(" ", "T") + "Z").getTime();
  const diffMin = Math.round((Date.now() - then) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function CheckpointRow({
  checkpoint,
  trendData,
}: {
  checkpoint: CheckpointData;
  trendData?: number[];
}) {
  const laneEntries = Object.entries(checkpoint.lanes);

  return (
    <div className="glass overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <h3 className="text-lg font-semibold">{checkpoint.name}</h3>
          {checkpoint.terminal && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Terminal {checkpoint.terminal}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            checkpoint.status === "open"
              ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              checkpoint.status === "open" ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {checkpoint.status === "open" ? "Open" : "Closed"}
        </span>
      </div>

      {/* Trend Chart */}
      {trendData && trendData.length >= 2 && (
        <div className="mt-4 px-5">
          <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
            <span>6h ago</span>
            <span>Now</span>
          </div>
          <Sparkline
            data={trendData}
            id={checkpoint.id}
            className="h-16 w-full"
          />
        </div>
      )}

      {/* Lanes */}
      {laneEntries.length === 0 ? (
        <p className="px-5 py-5 text-sm text-gray-400">
          No wait data available
        </p>
      ) : (
        <div className="mt-4 grid gap-2 px-5 pb-5 sm:grid-cols-3">
          {laneEntries.map(([lane, data]) => (
            <div
              key={lane}
              className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-3 dark:bg-white/[0.03]"
            >
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {laneLabels[lane] ?? lane}
              </span>
              <div className="flex items-center gap-1.5">
                <WaitBadge minutes={data.wait_minutes} />
                <TrendArrow trend={data.trend} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timestamp */}
      {checkpoint.updated_at && (
        <div className="border-t border-gray-100 px-5 py-2.5 dark:border-white/[0.04]">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Updated {relativeTime(checkpoint.updated_at)}
          </p>
        </div>
      )}
    </div>
  );
}
