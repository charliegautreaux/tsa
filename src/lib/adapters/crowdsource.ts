import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

function checkpointToId(airportCode: string, checkpoint: string): string {
  return `${airportCode.toLowerCase()}-${checkpoint.toLowerCase().replace(/\s+/g, "-")}`;
}

export const crowdsourceAdapter: FeedAdapter = {
  id: "crowdsource",

  async fetch(config: FeedConfig, env: Record<string, unknown>): Promise<RawReading[]> {
    const db = env.DB as D1Database;
    const since = new Date(Date.now() - 30 * 60_000).toISOString().replace("T", " ").slice(0, 19);

    const result = await db
      .prepare(
        `SELECT airport_code, checkpoint, lane_type, wait_minutes, created_at
         FROM reports
         WHERE airport_code = ?1 AND created_at > ?2
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .bind(config.airport_code, since)
      .all<{
        airport_code: string;
        checkpoint: string;
        lane_type: string;
        wait_minutes: number;
        created_at: string;
      }>();

    return result.results.map((r) => ({
      airport_code: r.airport_code,
      checkpoint_id: checkpointToId(r.airport_code, r.checkpoint),
      lane_type: r.lane_type as RawReading["lane_type"],
      wait_minutes: r.wait_minutes,
      confidence: 0.7,
      source_type: "crowdsourced" as const,
      measured_at: r.created_at,
    }));
  },

  async healthCheck(config: FeedConfig, env: Record<string, unknown>): Promise<FeedHealth> {
    const db = env.DB as D1Database;
    const start = performance.now();
    try {
      const since = new Date(Date.now() - 3600_000).toISOString().replace("T", " ").slice(0, 19);
      await db
        .prepare("SELECT COUNT(*) as count FROM reports WHERE airport_code = ?1 AND created_at > ?2")
        .bind(config.airport_code, since)
        .first();
      return {
        feed_id: config.id,
        is_healthy: true,
        response_time_ms: Math.round(performance.now() - start),
        last_error: null,
      };
    } catch (err) {
      return {
        feed_id: config.id,
        is_healthy: false,
        response_time_ms: Math.round(performance.now() - start),
        last_error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
};

registerAdapter(crowdsourceAdapter);
