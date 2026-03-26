import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import type { LaneType } from "@/lib/types/reading";
import { registerAdapter } from "./registry";

/**
 * Maps BlipTrack lane type strings to canonical LaneType values.
 */
function normalizeLane(raw: unknown): LaneType {
  if (typeof raw !== "string") return "unknown";
  const lower = raw.toLowerCase().trim();

  if (lower === "standard" || lower === "general" || lower === "regular") return "standard";
  if (lower === "precheck" || lower === "pre-check" || lower === "tsa-pre" || lower === "tsa pre") return "precheck";
  if (lower === "clear" || lower === "clear lane") return "clear";
  return "unknown";
}

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
 * Attempts to find the measurements array in BlipTrack/Veovo JSON responses.
 * Checks common top-level keys: measurements, queues, data.
 */
function findMeasurementsArray(json: unknown): unknown[] | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  for (const key of ["measurements", "queues", "data"] as const) {
    const val = obj[key];
    if (Array.isArray(val)) return val;
  }

  return null;
}

export const bliptrackAdapter: FeedAdapter = {
  id: "bliptrack",

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

    const measurements = findMeasurementsArray(json);
    if (!measurements) return [];

    const readings: RawReading[] = [];

    for (const item of measurements) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;

      const rawWait = m.currentWaitTime ?? m.waitTime;
      const wait_minutes =
        typeof rawWait === "number"
          ? rawWait
          : typeof rawWait === "string"
          ? parseFloat(rawWait)
          : NaN;

      if (isNaN(wait_minutes) || wait_minutes < 0) continue;

      const rawLane = m.laneType ?? m.lane_type ?? m.queueName ?? m.name;
      const lane_type = normalizeLane(rawLane);

      const rawTimestamp = m.timestamp ?? m.measuredAt ?? m.measured_at;
      const measured_at =
        typeof rawTimestamp === "string" && rawTimestamp.length > 0
          ? rawTimestamp
          : new Date().toISOString();

      readings.push({
        airport_code: config.airport_code,
        checkpoint_id: config.checkpoint_id ?? config.id,
        lane_type,
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

registerAdapter(bliptrackAdapter);
