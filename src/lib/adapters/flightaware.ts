import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

const AEROAPI_BASE = "https://aeroapi.flightaware.com/aeroapi";

export const flightawareAdapter: FeedAdapter = {
  id: "flightaware",

  /**
   * FlightAware flight data feeds into the prediction engine separately.
   * This adapter does not produce wait-time readings directly.
   */
  async fetch(_config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    return [];
  },

  async healthCheck(config: FeedConfig, env: Record<string, unknown>): Promise<FeedHealth> {
    const apiKey = env.FLIGHTAWARE_API_KEY;

    if (!apiKey || typeof apiKey !== "string") {
      return {
        feed_id: config.id,
        is_healthy: false,
        response_time_ms: 0,
        last_error: "FLIGHTAWARE_API_KEY not configured",
      };
    }

    const url = `${AEROAPI_BASE}/airports/${config.airport_code}/flights/departures`;

    const start = Date.now();
    try {
      const response = await fetch(url, {
        method: "HEAD",
        headers: {
          "x-apikey": apiKey,
        },
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

registerAdapter(flightawareAdapter);
