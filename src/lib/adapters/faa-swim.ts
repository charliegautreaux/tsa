import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * Live FAA NAS Status API — returns delay data for all US airports.
 * Free, public, no auth required. Updated every few minutes.
 */
const NAS_STATUS_URL = "https://nasstatus.faa.gov/api/airport-status-information";

/** Extract all ARPT codes from a delay section using regex. */
function extractDelayedAirports(xml: string): Set<string> {
  const codes = new Set<string>();
  const matches = xml.matchAll(/<ARPT>([A-Z]{3})<\/ARPT>/g);
  for (const m of matches) {
    codes.add(m[1]);
  }
  return codes;
}

export const faaSWIMAdapter: FeedAdapter = {
  id: "faa-swim",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    let xml: string;
    try {
      const response = await fetch(NAS_STATUS_URL, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      xml = await response.text();
    } catch {
      return [];
    }

    const delayedAirports = extractDelayedAirports(xml);

    if (!delayedAirports.has(config.airport_code)) return [];

    // Return a synthetic disruption reading — signals the prediction engine
    // to apply its disruption multiplier for this airport
    return [
      {
        airport_code: config.airport_code,
        checkpoint_id: config.checkpoint_id ?? config.id,
        lane_type: "unknown",
        wait_minutes: 0,
        confidence: 0.5,
        source_type: "predicted",
        measured_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      },
    ];
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    const start = Date.now();
    try {
      const response = await fetch(NAS_STATUS_URL, {
        method: "HEAD",
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

registerAdapter(faaSWIMAdapter);
