import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

const NOAA_OBS_BASE = "https://api.weather.gov/stations/K";

export const noaaAdapter: FeedAdapter = {
  id: "noaa",

  /**
   * NOAA weather data feeds into the prediction engine separately.
   * This adapter does not produce wait-time readings directly.
   */
  async fetch(_config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    return [];
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    const url = `${NOAA_OBS_BASE}${config.airport_code}/observations/latest`;

    const start = Date.now();
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "PreBoard.ai/1.0 (preboard.ai; contact@preboard.ai)",
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

registerAdapter(noaaAdapter);
