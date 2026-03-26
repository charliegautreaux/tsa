import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import type { LaneType } from "@/lib/types/reading";
import { registerAdapter } from "./registry";

/**
 * Extracts values from a JSON object using a simplified JSONPath expression.
 *
 * Supports:
 *   - `$.key.nested`          — simple nested property access
 *   - `$.key[*].field`        — array wildcard: maps over each element, extracts field
 *
 * Returns an array of extracted values (scalar paths return a single-element array).
 */
export function extractValues(obj: unknown, path: string): unknown[] {
  // Strip leading "$."
  if (!path.startsWith("$.")) return [];
  const normalized = path.slice(2); // remove "$."

  const segments = normalized.split(".");
  let current: unknown[] = [obj];

  for (const segment of segments) {
    const next: unknown[] = [];

    if (segment.endsWith("[*]")) {
      // Array wildcard segment — navigate to the key, then spread array elements
      const key = segment.slice(0, -3);
      for (const node of current) {
        if (node !== null && typeof node === "object") {
          const arr = (node as Record<string, unknown>)[key];
          if (Array.isArray(arr)) {
            next.push(...arr);
          }
        }
      }
    } else {
      // Normal property access
      for (const node of current) {
        if (node !== null && typeof node === "object") {
          const val = (node as Record<string, unknown>)[segment];
          if (val !== undefined) {
            next.push(val);
          }
        }
      }
    }

    current = next;
  }

  return current;
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
 * Normalises raw lane type strings to a canonical LaneType value.
 */
export function normalizeLaneType(raw: unknown): LaneType {
  if (typeof raw !== "string") return "unknown";
  const lower = raw.toLowerCase().trim();

  if (lower === "standard" || lower === "general" || lower === "regular") {
    return "standard";
  }
  if (lower === "precheck" || lower === "pre-check" || lower === "tsa-pre" || lower === "tsa pre") {
    return "precheck";
  }
  if (lower === "clear" || lower === "clear lane") {
    return "clear";
  }
  return "unknown";
}

export const dynamicJsonAdapter: FeedAdapter = {
  id: "dynamic-json",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.dynamic_mapping || !config.url) return [];

    let json: unknown;
    try {
      const response = await fetch(config.url, { headers: buildHeaders(config) });
      if (!response.ok) return [];
      json = await response.json();
    } catch {
      return [];
    }

    const mapping = config.dynamic_mapping;

    // Extract arrays for each mapped field
    const waitValues = extractValues(json, mapping.wait_minutes ?? "");
    const laneValues = extractValues(json, mapping.lane_type ?? "");
    const measuredAtValues = extractValues(json, mapping.measured_at ?? "");

    if (waitValues.length === 0) return [];

    // measured_at may be a scalar (one timestamp for all rows) — broadcast it
    const getTimestamp = (index: number): string => {
      const val = measuredAtValues.length === 1 ? measuredAtValues[0] : measuredAtValues[index];
      return typeof val === "string" ? val : new Date().toISOString();
    };

    const readings: RawReading[] = [];

    for (let i = 0; i < waitValues.length; i++) {
      const raw_wait = waitValues[i];
      const wait_minutes = typeof raw_wait === "number" ? raw_wait : Number(raw_wait);
      if (isNaN(wait_minutes) || wait_minutes < 0) continue;

      const raw_lane = laneValues.length > i ? laneValues[i] : undefined;
      const lane_type = normalizeLaneType(raw_lane ?? "standard");

      readings.push({
        airport_code: config.airport_code,
        checkpoint_id: config.checkpoint_id ?? config.id,
        lane_type,
        wait_minutes,
        confidence: 0.8,
        source_type: "airport-api",
        measured_at: getTimestamp(i),
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(config.url, {
        method: "HEAD",
        headers: buildHeaders(config),
        signal: controller.signal,
      });
      clearTimeout(timeout);
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

registerAdapter(dynamicJsonAdapter);
