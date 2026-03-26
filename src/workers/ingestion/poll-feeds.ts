import { getActiveFeeds } from "@/lib/db/d1";
import { getAdapter } from "@/lib/adapters/registry";
import { processReadings } from "./process-reading";
import type { FeedConfig } from "@/lib/types/feed";

// Import all adapters to register them
import "@/lib/adapters/crowdsource";
import "@/lib/adapters/dynamic-json";
import "@/lib/adapters/airport-json";
import "@/lib/adapters/airport-html";
import "@/lib/adapters/bliptrack";
import "@/lib/adapters/xovis";
import "@/lib/adapters/faa-swim";
import "@/lib/adapters/flightaware";
import "@/lib/adapters/noaa";
import "@/lib/adapters/tsa-throughput";

interface PollResult {
  feeds_polled: number;
  total_readings: number;
  total_processed: number;
  total_rejected: number;
  errors: Array<{ feed_id: string; error: string }>;
}

export async function pollFeeds(
  db: D1Database,
  kv: KVNamespace,
  env: Record<string, unknown>
): Promise<PollResult> {
  const result: PollResult = {
    feeds_polled: 0,
    total_readings: 0,
    total_processed: 0,
    total_rejected: 0,
    errors: [],
  };

  const feeds = await getActiveFeeds(db);

  // Group feeds by airport for efficient batch processing
  const feedsByAirport = new Map<string, FeedConfig[]>();
  for (const feed of feeds) {
    const group = feedsByAirport.get(feed.airport_code) || [];
    group.push(feed);
    feedsByAirport.set(feed.airport_code, group);
  }

  for (const [_airportCode, airportFeeds] of feedsByAirport) {
    const allReadings = [];

    for (const feed of airportFeeds) {
      const adapter = getAdapter(feed.adapter);
      if (!adapter) {
        result.errors.push({ feed_id: feed.id, error: `Unknown adapter: ${feed.adapter}` });
        continue;
      }

      try {
        const readings = await adapter.fetch(feed, env);
        allReadings.push(...readings);
        result.feeds_polled++;
        result.total_readings += readings.length;

        // Update feed success timestamp
        await db
          .prepare("UPDATE feeds SET last_success_at = datetime('now'), success_count_1h = success_count_1h + 1 WHERE id = ?1")
          .bind(feed.id)
          .run();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        result.errors.push({ feed_id: feed.id, error: errorMsg });

        await db
          .prepare("UPDATE feeds SET last_error_at = datetime('now'), last_error = ?2, error_count_1h = error_count_1h + 1 WHERE id = ?1")
          .bind(feed.id, errorMsg)
          .run();
      }
    }

    if (allReadings.length > 0) {
      const processResult = await processReadings(allReadings, db, kv);
      result.total_processed += processResult.processed;
      result.total_rejected += processResult.rejected;
    }
  }

  return result;
}
