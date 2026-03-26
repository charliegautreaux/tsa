import { getActiveFeeds, updateFeedStatus, getFeedErrorRate } from "@/lib/db/d1";
import type { FeedConfig } from "@/lib/types/feed";

export interface HealthAssessment {
  status: "healthy" | "stale" | "degraded" | "failing";
  action: "none" | "flag" | "reduce-frequency" | "deactivate";
  reason: string;
}

interface FeedMetrics {
  errorCount: number;
  successCount: number;
  sameValueStreak: number;
  lastValue: number | null;
}

export function assessFeedHealth(metrics: FeedMetrics): HealthAssessment {
  const total = metrics.errorCount + metrics.successCount;
  const errorRate = total > 0 ? metrics.errorCount / total : 0;

  // Stale check: same value 10+ times in a row
  if (metrics.sameValueStreak >= 10) {
    return { status: "stale", action: "flag", reason: `Same value (${metrics.lastValue}) repeated ${metrics.sameValueStreak}x` };
  }

  // Error rate thresholds
  if (errorRate >= 0.5) {
    return { status: "failing", action: "deactivate", reason: `Error rate ${(errorRate * 100).toFixed(0)}% exceeds 50% threshold` };
  }

  if (errorRate >= 0.3) {
    return { status: "degraded", action: "reduce-frequency", reason: `Error rate ${(errorRate * 100).toFixed(0)}% exceeds 30% threshold` };
  }

  return { status: "healthy", action: "none", reason: "Feed operating normally" };
}

/** Run health check across all active feeds */
export async function runHealthCheck(db: D1Database): Promise<{
  checked: number;
  degraded: number;
  deactivated: number;
}> {
  const result = { checked: 0, degraded: 0, deactivated: 0 };
  const feeds = await getActiveFeeds(db);

  for (const feed of feeds) {
    result.checked++;
    const errorRate = await getFeedErrorRate(db, feed.id);

    const assessment = assessFeedHealth({
      errorCount: errorRate.error_count,
      successCount: errorRate.success_count,
      sameValueStreak: 0,
      lastValue: null,
    });

    switch (assessment.action) {
      case "deactivate":
        await updateFeedStatus(db, feed.id, "inactive");
        result.deactivated++;
        break;
      case "reduce-frequency":
        await updateFeedStatus(db, feed.id, "degraded");
        result.degraded++;
        break;
    }
  }

  return result;
}
