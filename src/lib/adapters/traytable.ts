import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import type { LaneType } from "@/lib/types/reading";
import { registerAdapter } from "./registry";

/**
 * Adapter for the From the Tray Table TSA Wait Time API.
 *
 * Free, public, no auth. Returns real-time TSA checkpoint wait times
 * scraped from individual airport websites every ~5 minutes.
 *
 * API: https://tsa.fromthetraytable.com/api/tsa/airports/{CODE}
 * Coverage: ~21 live US airports with per-checkpoint, per-lane detail.
 */

const API_BASE = "https://tsa.fromthetraytable.com/api/tsa/airports";

interface TrayTableCheckpoint {
  name: string;
  waitMinutes: number | null;
  waitRangeMin: number | null;
  waitRangeMax: number | null;
  status: string;
  lanes: string[];
  lastUpdated: string;
}

interface TrayTableResponse {
  airport: {
    code: string;
    name: string;
    checkpointCount: number;
    openCheckpoints: number;
    lastScraped: string;
    scrapeError: string | null;
    checkpoints: TrayTableCheckpoint[];
  };
}

/** Derive lane type from checkpoint name and lanes array. */
function deriveLaneType(cp: TrayTableCheckpoint): LaneType {
  const name = cp.name.toLowerCase();
  const lanesStr = cp.lanes.join(" ").toLowerCase();

  if (name.includes("clear") || lanesStr.includes("clear")) return "clear";
  if (name.includes("precheck") || name.includes("pre✓") || name.includes("pre\u2713") ||
      lanesStr.includes("pre") || lanesStr.includes("pre✓")) return "precheck";
  if (name.includes("standard") || name.includes("general") || name.includes("regular")) return "standard";

  // If no lane indicators and no specific lanes listed, default to standard
  if (cp.lanes.length === 0) return "standard";

  return "standard";
}

/** Derive a stable checkpoint ID from airport code and checkpoint name. */
function deriveCheckpointId(airportCode: string, name: string): string {
  // Strip lane type suffixes to group lanes under the same checkpoint
  const cleaned = name
    .replace(/\s*\((?:Standard|PreCheck|Pre✓|TSA Pre✓|CLEAR|Priority|Spot Saver)\)\s*/gi, "")
    .trim();
  return `${airportCode.toLowerCase()}-${cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}`;
}

export const traytableAdapter: FeedAdapter = {
  id: "traytable",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    const url = config.url ?? `${API_BASE}/${config.airport_code}`;

    let data: TrayTableResponse;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      data = await response.json() as TrayTableResponse;
    } catch {
      return [];
    }

    const airport = data.airport;
    if (!airport || airport.scrapeError || !airport.checkpoints) return [];

    const readings: RawReading[] = [];

    for (const cp of airport.checkpoints) {
      if (cp.status !== "open" || cp.waitMinutes == null) continue;

      readings.push({
        airport_code: config.airport_code,
        checkpoint_id: deriveCheckpointId(config.airport_code, cp.name),
        lane_type: deriveLaneType(cp),
        wait_minutes: cp.waitMinutes,
        confidence: 0.9,
        source_type: "airport-api",
        measured_at: cp.lastUpdated
          ? cp.lastUpdated.replace("T", " ").slice(0, 19)
          : new Date().toISOString().replace("T", " ").slice(0, 19),
      });
    }

    return readings;
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    const url = config.url ?? `${API_BASE}/${config.airport_code}`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        return {
          feed_id: config.id,
          is_healthy: false,
          response_time_ms: Date.now() - start,
          last_error: `HTTP ${response.status}`,
        };
      }

      const data = await response.json() as TrayTableResponse;
      const hasError = !!data.airport?.scrapeError;

      return {
        feed_id: config.id,
        is_healthy: !hasError,
        response_time_ms: Date.now() - start,
        last_error: hasError ? data.airport.scrapeError : null,
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

registerAdapter(traytableAdapter);
