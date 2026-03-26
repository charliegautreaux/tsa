import { getInactiveFeeds, updateFeedStatus } from "@/lib/db/d1";
import { getAdapter } from "@/lib/adapters/registry";
import type { FeedConfig } from "@/lib/types/feed";

const RETRY_INTERVAL_MS = 6 * 3600_000;  // 6 hours
const DORMANT_THRESHOLD_MS = 7 * 24 * 3600_000;  // 7 days
const DEAD_THRESHOLD_MS = 30 * 24 * 3600_000;  // 30 days

export function shouldRetry(status: string, lastErrorAt: string | null): boolean {
  if (status !== "inactive" && status !== "degraded") return false;
  if (!lastErrorAt) return true;
  const elapsed = Date.now() - new Date(lastErrorAt).getTime();
  return elapsed >= RETRY_INTERVAL_MS;
}

export function shouldMarkDormant(status: string, lastSuccessAt: string | null): boolean {
  if (status !== "inactive") return false;
  if (!lastSuccessAt) return true;
  const elapsed = Date.now() - new Date(lastSuccessAt).getTime();
  return elapsed >= DORMANT_THRESHOLD_MS;
}

export function shouldMarkDead(status: string, lastSuccessAt: string | null): boolean {
  if (status !== "dormant") return false;
  if (!lastSuccessAt) return true;
  const elapsed = Date.now() - new Date(lastSuccessAt).getTime();
  return elapsed >= DEAD_THRESHOLD_MS;
}

/** Run self-healing across all inactive/degraded feeds */
export async function runSelfHeal(
  db: D1Database,
  env: Record<string, unknown>
): Promise<{
  retried: number;
  reactivated: number;
  dormant: number;
  dead: number;
}> {
  const result = { retried: 0, reactivated: 0, dormant: 0, dead: 0 };
  const feeds = await getInactiveFeeds(db);

  for (const feed of feeds) {
    // Check for dormant/dead transitions
    if (shouldMarkDead(feed.status, null)) {
      await updateFeedStatus(db, feed.id, "dead");
      result.dead++;
      continue;
    }

    if (shouldMarkDormant(feed.status, null)) {
      await updateFeedStatus(db, feed.id, "dormant");
      result.dormant++;
      continue;
    }

    // Try to retry inactive feeds
    if (shouldRetry(feed.status, null)) {
      const adapter = getAdapter(feed.adapter);
      if (!adapter) continue;

      try {
        const health = await adapter.healthCheck(feed, env);
        result.retried++;

        if (health.is_healthy) {
          await updateFeedStatus(db, feed.id, "active");
          result.reactivated++;
        }
      } catch {
        // Retry failed, stay inactive
      }
    }
  }

  return result;
}
