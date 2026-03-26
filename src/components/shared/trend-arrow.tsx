import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { Trend } from "@/lib/types/reading";

const config: Record<Trend, { Icon: typeof ArrowUp; className: string; label: string }> = {
  rising: { Icon: ArrowUp, className: "text-red-500", label: "Rising" },
  falling: { Icon: ArrowDown, className: "text-green-500", label: "Falling" },
  stable: { Icon: Minus, className: "text-gray-400", label: "Stable" },
};

export function TrendArrow({ trend }: { trend: Trend | null }) {
  if (!trend) return null;
  const { Icon, className, label } = config[trend];
  return <Icon className={`h-4 w-4 ${className}`} aria-label={label} />;
}
