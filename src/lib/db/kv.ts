import type { CurrentWait } from "@/lib/types/reading";
import type { AirportOverview } from "@/lib/types/airport";

const CURRENT_WAITS_KEY = "current_waits:";
const MAP_OVERVIEW_KEY = "map:overview";
const AIRPORT_LIVE_KEY = "airport:live:";

export async function cacheCurrentWaits(
  kv: KVNamespace,
  airportCode: string,
  waits: CurrentWait[]
): Promise<void> {
  await kv.put(`${CURRENT_WAITS_KEY}${airportCode}`, JSON.stringify(waits), { expirationTtl: 60 });
}

export async function getCachedCurrentWaits(
  kv: KVNamespace,
  airportCode: string
): Promise<CurrentWait[] | null> {
  const cached = await kv.get(`${CURRENT_WAITS_KEY}${airportCode}`);
  if (!cached) return null;
  return JSON.parse(cached) as CurrentWait[];
}

export async function cacheMapOverview(
  kv: KVNamespace,
  overview: AirportOverview[]
): Promise<void> {
  await kv.put(MAP_OVERVIEW_KEY, JSON.stringify(overview), { expirationTtl: 60 });
}

export async function getCachedMapOverview(
  kv: KVNamespace
): Promise<AirportOverview[] | null> {
  const cached = await kv.get(MAP_OVERVIEW_KEY);
  if (!cached) return null;
  return JSON.parse(cached) as AirportOverview[];
}

export async function cacheAirportLive(
  kv: KVNamespace,
  airportCode: string,
  data: unknown
): Promise<void> {
  await kv.put(`${AIRPORT_LIVE_KEY}${airportCode}`, JSON.stringify(data), { expirationTtl: 30 });
}

export async function getCachedAirportLive(
  kv: KVNamespace,
  airportCode: string
): Promise<unknown | null> {
  const cached = await kv.get(`${AIRPORT_LIVE_KEY}${airportCode}`);
  if (!cached) return null;
  return JSON.parse(cached);
}

export async function invalidateAirportCache(
  kv: KVNamespace,
  airportCode: string
): Promise<void> {
  await Promise.all([
    kv.delete(`${CURRENT_WAITS_KEY}${airportCode}`),
    kv.delete(`${AIRPORT_LIVE_KEY}${airportCode}`),
    kv.delete(MAP_OVERVIEW_KEY),
  ]);
}
