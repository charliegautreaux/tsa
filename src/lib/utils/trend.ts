import type { Trend } from "@/lib/types/reading";

/**
 * Calculate wait time trend using linear regression slope.
 * slope > 0.5 = rising, < -0.5 = falling, else stable.
 */
export function calculateTrend(waitMinutes: number[]): Trend {
  if (waitMinutes.length < 2) return "stable";
  const n = waitMinutes.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += waitMinutes[i];
    sumXY += i * waitMinutes[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  if (slope > 0.5) return "rising";
  if (slope < -0.5) return "falling";
  return "stable";
}
