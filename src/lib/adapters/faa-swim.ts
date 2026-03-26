import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

const FAA_STATUS_BASE = "https://soa.smext.faa.gov/asws/api/airport/status";

export const faaSWIMAdapter: FeedAdapter = {
  id: "faa-swim",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    const url =
      config.url ?? `${FAA_STATUS_BASE}/${config.airport_code}`;

    let json: unknown;
    try {
      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      json = await response.json();
    } catch {
      return [];
    }

    if (!json || typeof json !== "object") return [];
    const data = json as Record<string, unknown>;

    // Check for delay status — any truthy delay indicator triggers a synthetic reading
    const hasDelay =
      data.status === "Delay" ||
      (data.delay === true) ||
      (typeof data.delay === "string" && data.delay.toLowerCase() !== "false" && data.delay.toLowerCase() !== "no");

    if (!hasDelay) return [];

    // Return a synthetic predicted reading signaling disruption
    return [
      {
        airport_code: config.airport_code,
        checkpoint_id: config.checkpoint_id ?? config.id,
        lane_type: "unknown",
        wait_minutes: 0,
        confidence: 0.5,
        source_type: "predicted",
        measured_at: new Date().toISOString(),
      },
    ];
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    const url =
      config.url ?? `${FAA_STATUS_BASE}/${config.airport_code}`;

    const start = Date.now();
    try {
      const response = await fetch(url, {
        method: "HEAD",
        headers: { "Accept": "application/json" },
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
