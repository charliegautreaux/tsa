import { cn } from "@/lib/utils/cn";

function getBadgeClasses(min: number): string {
  if (min <= 15)
    return "bg-green-500 text-white dark:bg-green-500/15 dark:text-green-400";
  if (min <= 30)
    return "bg-yellow-500 text-white dark:bg-yellow-500/15 dark:text-yellow-400";
  if (min <= 60)
    return "bg-orange-500 text-white dark:bg-orange-500/15 dark:text-orange-400";
  return "bg-red-500 text-white dark:bg-red-500/15 dark:text-red-400";
}

export function WaitBadge({
  minutes,
  size = "md",
}: {
  minutes: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const display = minutes != null ? `${Math.round(minutes)}m` : "\u2014";

  const colorClass =
    minutes != null
      ? getBadgeClasses(minutes)
      : "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-500";

  const sizeClass = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base font-semibold",
  }[size];

  return (
    <span
      className={cn(
        "inline-block rounded-lg tabular-nums font-medium",
        colorClass,
        sizeClass
      )}
    >
      {display}
    </span>
  );
}
