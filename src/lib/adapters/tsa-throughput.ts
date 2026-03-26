import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

const TSA_VOLUMES_URL = "https://www.tsa.gov/travel/passenger-volumes";

export const tsaThroughputAdapter: FeedAdapter = {
  id: "tsa-throughput",

  /**
   * TSA daily passenger volumes feed into the prediction engine as aggregates.
   * This adapter does not produce per-checkpoint wait-time readings directly.
   */
  async fetch(_config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    return [];
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    const url = config.url ?? TSA_VOLUMES_URL;

    const start = Date.now();
    try {
      const response = await fetch(url, {
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

registerAdapter(tsaThroughputAdapter);
