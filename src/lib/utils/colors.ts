export const WAIT_COLORS = {
  green: { light: "#22c55e", dark: "#4ade80" },
  yellow: { light: "#eab308", dark: "#facc15" },
  orange: { light: "#f97316", dark: "#fb923c" },
  red: { light: "#ef4444", dark: "#f87171" },
} as const;

export type WaitColor = (typeof WAIT_COLORS)[keyof typeof WAIT_COLORS];
export type WaitSeverity = "low" | "moderate" | "high" | "severe";

export function getWaitColor(minutes: number): WaitColor {
  if (!minutes || minutes <= 15) return WAIT_COLORS.green;
  if (minutes <= 30) return WAIT_COLORS.yellow;
  if (minutes <= 60) return WAIT_COLORS.orange;
  return WAIT_COLORS.red;
}

export function getWaitSeverity(minutes: number): WaitSeverity {
  if (!minutes || minutes <= 15) return "low";
  if (minutes <= 30) return "moderate";
  if (minutes <= 60) return "high";
  return "severe";
}

export function getWaitTailwindClass(minutes: number): string {
  if (!minutes || minutes <= 15) return "text-green-500";
  if (minutes <= 30) return "text-yellow-500";
  if (minutes <= 60) return "text-orange-500";
  return "text-red-500";
}

export function getWaitBgClass(minutes: number): string {
  if (!minutes || minutes <= 15) return "bg-green-500";
  if (minutes <= 30) return "bg-yellow-500";
  if (minutes <= 60) return "bg-orange-500";
  return "bg-red-500";
}
