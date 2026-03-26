import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * Builds HTTP headers from the feed's auth_config.
 */
function buildHeaders(config: FeedConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.auth_config.type === "api-key") {
    headers[config.auth_config.header] = config.auth_config.key;
  } else if (config.auth_config.type === "bearer") {
    headers["Authorization"] = `Bearer ${config.auth_config.token}`;
  }

  return headers;
}

/**
 * Attempts to find the zones/sensors array in Xovis JSON responses.
 * Checks common top-level keys: zones, sensors, data.
 */
function findZonesArray(json: unknown): unknown[] | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  for (const key of ["zones", "sensors", "data"] as const) {
    const val = obj[key];
    if (Array.isArray(val)) return val;
  }

  return null;
}

export const xovisAdapter: FeedAdapter = {
  id: "xovis",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.url) return [];

    let json: unknown;
    try {
      const response = await fetch(config.url, {
        headers: buildHeaders(config),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      json = await response.json();
    } catch {
      return [];
    }

    const zones = findZonesArray(json);
    if (!zones) return [];

    const readings: RawReading[] = [];

    for (const item of zones) {
      if (!item || typeof item !== "object") continue;
      const z = item as Record<string, unknown>;

      let wait_minutes: number;

      // Try direct wait time fields first
      const rawWait = z.estimatedWaitMinutes ?? z.waitTime;
      if (rawWait !== undefined) {
        wait_minutes =
          typeof rawWait === "number"
            ? rawWait
            : typeof rawWait === "string"
            ? parseFloat(rawWait)
            : NaN;
      } else {
        // Estimate from personCount / throughput (throughput in persons/min)
        const personCount =
          typeof z.personCount === "number"
            ? z.personCount
            : typeof z.personCount === "string"
            ? parseFloat(z.personCount)
            : NaN;
        const throughput =
          typeof z.throughput === "number"
            ? z.throughput
            : typeof z.throughput === "string"
            ? parseFloat(z.throughput)
            : NaN;

        wait_minutes =
          !isNaN(personCount) && !isNaN(throughput) && throughput > 0
            ? personCount / throughput
            : NaN;
      }

      if (isNaN(wait_minutes) || wait_minutes < 0) continue;

      const rawTimestamp = z.timestamp ?? z.measuredAt ?? z.measured_at;
      const measured_at =
        typeof rawTimestamp === "string" && rawTimestamp.length > 0
          ? rawTimestamp
          : new Date().toISOString();

      readings.push({
        airport_code: config.airport_code,
        checkpoint_id: config.checkpoint_id ?? config.id,
        lane_type: "unknown",
        wait_minutes,
        confidence: 0.95,
        source_type: "sensor",
        measured_at,
      });
    }

    return readings;
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    if (!config.url) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: 0, last_error: "No URL configured" };
    }

    const start = Date.now();
    try {
      const response = await fetch(config.url, {
        method: "HEAD",
        headers: buildHeaders(config),
        signal: AbortSignal.timeout(5_000),
      });
      return {
        feed_id: config.id,
        is_healthy: response.ok,
        response_time_ms: Date.now() - start,
        last_error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        feed_id: config.id,
        is_healthy: false,
        response_time_ms: Date.now() - start,
        last_error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
};

registerAdapter(xovisAdapter);
