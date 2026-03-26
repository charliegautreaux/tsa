import type { DataTier } from "@/lib/types/airport";

const tierConfig: Record<DataTier, { label: string; className: string; pulse: boolean }> = {
  live: {
    label: "LIVE",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pulse: true,
  },
  "near-live": {
    label: "~1 min",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    pulse: false,
  },
  predicted: {
    label: "Predicted",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    pulse: false,
  },
  stale: {
    label: "Stale",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    pulse: false,
  },
};

export function DataTierBadge({ tier }: { tier: DataTier }) {
  const config = tierConfig[tier];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {config.label}
    </span>
  );
}
