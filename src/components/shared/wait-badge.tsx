import { getWaitBgClass } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";

export function WaitBadge({
  minutes,
  size = "md",
}: {
  minutes: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const display = minutes != null ? `${Math.round(minutes)}m` : "—";
  const bgClass = minutes != null ? getWaitBgClass(minutes) : "bg-gray-400";

  const sizeClass = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-sm",
    lg: "px-3 py-1.5 text-base font-semibold",
  }[size];

  return (
    <span
      className={cn(
        "inline-block rounded-md text-white tabular-nums",
        bgClass,
        sizeClass
      )}
    >
      {display}
    </span>
  );
}
