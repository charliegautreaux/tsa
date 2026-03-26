import type { HistoricalPattern } from "@/lib/types/prediction";

export const DEFAULT_WAIT_MINUTES = 20;

/** Linearly interpolate between two values */
export function interpolateHour(startVal: number, endVal: number, fraction: number): number {
  return startVal + (endVal - startVal) * fraction;
}

/** Get base wait time from historical patterns */
export function getBaseWait(
  patterns: HistoricalPattern[],
  checkpointId: string,
  laneType: string,
  dayOfWeek: number,
  hour: number
): number {
  const floorHour = Math.floor(hour);
  const ceilHour = floorHour + 1;
  const fraction = hour - floorHour;

  const matching = patterns.filter(
    (p) => p.checkpoint_id === checkpointId && p.lane_type === laneType && p.day_of_week === dayOfWeek
  );

  if (matching.length === 0) return DEFAULT_WAIT_MINUTES;

  const floorMatch = matching.find((p) => p.hour === floorHour);
  const ceilMatch = matching.find((p) => p.hour === (ceilHour % 24));

  if (!floorMatch && !ceilMatch) return DEFAULT_WAIT_MINUTES;
  if (!floorMatch) return ceilMatch!.avg_wait;
  if (!ceilMatch || fraction === 0) return floorMatch.avg_wait;

  return interpolateHour(floorMatch.avg_wait, ceilMatch.avg_wait, fraction);
}

/** Apply day-of-week modifiers (weekends are typically lighter) */
export function getDayFactor(dayOfWeek: number): number {
  const factors: Record<number, number> = {
    0: 0.75,  // Sunday
    1: 1.1,   // Monday
    2: 0.95,  // Tuesday
    3: 0.9,   // Wednesday
    4: 1.05,  // Thursday
    5: 1.15,  // Friday
    6: 0.8,   // Saturday
  };
  return factors[dayOfWeek] ?? 1.0;
}

/** Apply time-of-day modifiers for airports without enough historical data */
export function getHourFactor(hour: number): number {
  if (hour >= 5 && hour <= 8) return 1.3;
  if (hour >= 9 && hour <= 11) return 1.1;
  if (hour >= 12 && hour <= 13) return 0.9;
  if (hour >= 14 && hour <= 17) return 1.2;
  if (hour >= 18 && hour <= 20) return 1.0;
  return 0.6;
}
