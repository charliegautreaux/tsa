import type { AirportSize } from "@/lib/types/airport";

/** Polling interval in seconds, keyed by airport hub size */
const POLLING_TIERS: Record<AirportSize, number> = {
  large_hub: 60,
  medium_hub: 300,
  small_hub: 900,
  nonhub: 1800,
  unknown: 1800,
};

export function getPollingInterval(size: AirportSize): number {
  return POLLING_TIERS[size] ?? 1800;
}

export function shouldPollNow(
  size: AirportSize,
  lastSuccessAt: string | null
): boolean {
  if (!lastSuccessAt) return true;
  const elapsed = (Date.now() - new Date(lastSuccessAt).getTime()) / 1000;
  return elapsed >= getPollingInterval(size);
}
