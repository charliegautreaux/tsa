import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import type { LaneType } from "@/lib/types/reading";
import { registerAdapter } from "./registry";

/** Canonical keys to search for the checkpoints array, in priority order. */
const CHECKPOINT_KEYS = [
  "checkpoints",
  "security",
  "waitTimes",
  "wait_times",
  "data",
  "results",
] as const;

/** Timestamp field names to try on a checkpoint object. */
const TIMESTAMP_KEYS = ["updated", "timestamp", "last_updated", "updatedAt", "time"] as const;

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
 * Maps common raw lane-type strings to a canonical LaneType.
 *
 * general / regular → standard
 * pre-check / tsa-pre → precheck
 * clear → clear
 * anything else → unknown
 */
export function normalizeLane(raw: unknown): LaneType {
  if (typeof raw !== "string") return "unknown";
  const lower = raw.toLowerCase().trim();

  if (lower === "standard" || lower === "general" || lower === "regular") return "standard";
  if (lower === "precheck" || lower === "pre-check" || lower === "tsa-pre" || lower === "tsa pre") return "precheck";
  if (lower === "clear" || lower === "clear lane") return "clear";
  return "unknown";
}

/**
 * Attempts to find a checkpoint array by scanning known top-level keys and
 * one level of nesting within those keys.
 */
function findCheckpointArray(json: unknown): unknown[] | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  for (const key of CHECKPOINT_KEYS) {
    const val = obj[key];
    if (Array.isArray(val)) return val;

    // One level of nesting: e.g. { data: { checkpoints: [...] } }
    if (val && typeof val === "object") {
      const nested = val as Record<string, unknown>;
      for (const nestedKey of CHECKPOINT_KEYS) {
        const nestedVal = nested[nestedKey];
        if (Array.isArray(nestedVal)) return nestedVal;
      }
    }
  }

  return null;
}

/** Extracts a timestamp string from a checkpoint object, falling back to now. */
function extractTimestamp(cp: Record<string, unknown>): string {
  for (const key of TIMESTAMP_KEYS) {
    const val = cp[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return new Date().toISOString();
}

/** Returns a numeric wait value or NaN if not parseable. */
function toWaitMinutes(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val);
  return NaN;
}

/**
 * Parses a single checkpoint object into one or more RawReadings.
 *
 * Supports three formats:
 *   Format 1 — waits object: `{ waits: { general: 22, precheck: 8 } }`
 *   Format 2 — lanes array:  `{ lanes: [{ type: "standard", wait: 15 }] }`
 *   Format 3 — flat fields:  `{ wait_time: 22, precheck: 8 }`
 */
function parseCheckpoint(
  cp: unknown,
  config: FeedConfig,
): RawReading[] {
  if (!cp || typeof cp !== "object") return [];
  const obj = cp as Record<string, unknown>;

  const airport_code = config.airport_code;
  const checkpoint_id = config.checkpoint_id ?? config.id;
  const measured_at = extractTimestamp(obj);
  const confidence = 0.85;
  const source_type = "airport-api" as const;

  const readings: RawReading[] = [];

  // --- Format 1: waits object ---
  if (obj.waits && typeof obj.waits === "object" && !Array.isArray(obj.waits)) {
    const waits = obj.waits as Record<string, unknown>;
    for (const [laneRaw, waitRaw] of Object.entries(waits)) {
      const wait_minutes = toWaitMinutes(waitRaw);
      if (isNaN(wait_minutes) || wait_minutes < 0) continue;
      readings.push({
        airport_code,
        checkpoint_id,
        lane_type: normalizeLane(laneRaw),
        wait_minutes,
        confidence,
        source_type,
        measured_at,
      });
    }
    return readings;
  }

  // --- Format 2: lanes array ---
  if (Array.isArray(obj.lanes)) {
    for (const lane of obj.lanes) {
      if (!lane || typeof lane !== "object") continue;
      const l = lane as Record<string, unknown>;
      const wait_minutes = toWaitMinutes(l.wait ?? l.wait_minutes ?? l.waitMinutes);
      if (isNaN(wait_minutes) || wait_minutes < 0) continue;
      readings.push({
        airport_code,
        checkpoint_id,
        lane_type: normalizeLane(l.type ?? l.lane_type ?? l.laneType),
        wait_minutes,
        confidence,
        source_type,
        measured_at,
      });
    }
    return readings;
  }

  // --- Format 3: flat fields ---
  const FLAT_WAIT_KEYS = ["wait_time", "waitTime", "wait", "wait_minutes", "waitMinutes"] as const;
  const FLAT_LANE_KEYS: Array<[string, string]> = [
    ["precheck", "precheck"],
    ["pre_check", "precheck"],
    ["clear", "clear"],
    ["standard", "standard"],
    ["general", "standard"],
    ["regular", "standard"],
  ];

  // Try a primary wait field with a generic lane
  for (const waitKey of FLAT_WAIT_KEYS) {
    const wait_minutes = toWaitMinutes(obj[waitKey]);
    if (!isNaN(wait_minutes) && wait_minutes >= 0) {
      readings.push({
        airport_code,
        checkpoint_id,
        lane_type: "standard",
        wait_minutes,
        confidence,
        source_type,
        measured_at,
      });
      break;
    }
  }

  // Additionally scan named lane keys
  for (const [key, lane] of FLAT_LANE_KEYS) {
    // Skip if it was already captured as the primary wait
    if (FLAT_WAIT_KEYS.includes(key as typeof FLAT_WAIT_KEYS[number])) continue;
    const wait_minutes = toWaitMinutes(obj[key]);
    if (!isNaN(wait_minutes) && wait_minutes >= 0) {
      readings.push({
        airport_code,
        checkpoint_id,
        lane_type: normalizeLane(lane),
        wait_minutes,
        confidence,
        source_type,
        measured_at,
      });
    }
  }

  return readings;
}

export const airportJsonAdapter: FeedAdapter = {
  id: "airport-json",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.url) return [];

    let json: unknown;
    try {
      const response = await fetch(config.url, { headers: buildHeaders(config) });
      if (!response.ok) return [];
      json = await response.json();
    } catch {
      return [];
    }

    const checkpoints = findCheckpointArray(json);
    if (!checkpoints) return [];

    const readings: RawReading[] = [];
    for (const cp of checkpoints) {
      readings.push(...parseCheckpoint(cp, config));
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

registerAdapter(airportJsonAdapter);
