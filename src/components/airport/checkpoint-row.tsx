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
  precheck: "TSA Pre✓",
  clear: "CLEAR",
};

export function CheckpointRow({ checkpoint }: { checkpoint: CheckpointData }) {
  const laneEntries = Object.entries(checkpoint.lanes);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{checkpoint.name}</h3>
          {checkpoint.terminal && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Terminal {checkpoint.terminal}
            </p>
          )}
        </div>
        <span
          className={`text-xs font-medium ${
            checkpoint.status === "open"
              ? "text-green-600 dark:text-green-400"
              : "text-red-500"
          }`}
        >
          {checkpoint.status === "open" ? "Open" : "Closed"}
        </span>
      </div>

      {laneEntries.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No wait data available</p>
      ) : (
        <div className="mt-3 space-y-2">
          {laneEntries.map(([lane, data]) => (
            <div
              key={lane}
              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800"
            >
              <span className="text-sm font-medium">
                {laneLabels[lane] ?? lane}
              </span>
              <div className="flex items-center gap-2">
                <WaitBadge minutes={data.wait_minutes} />
                <TrendArrow trend={data.trend} />
              </div>
            </div>
          ))}
        </div>
      )}

      {checkpoint.updated_at && (
        <p className="mt-2 text-xs text-gray-400">
          Updated {new Date(checkpoint.updated_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
