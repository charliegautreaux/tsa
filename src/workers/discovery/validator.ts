import type { FeedConfig } from "@/lib/types/feed";
import { updateFeedStatus, updateFeedReliability, getTrialFeeds } from "@/lib/db/d1";
import { DISCOVERY_THRESHOLDS } from "@/lib/config/discovery.config";

interface EvaluationResult {
  feed_id: string;
  action: "activate" | "reject" | "continue";
  reliability_score: number;
  reason: string;
}

/** Check if a trial feed should be activated */
export function shouldActivate(
  reliabilityScore: number,
  successCount: number,
  errorCount: number
): boolean {
  const totalPolls = successCount + errorCount;
  if (totalPolls < 50) return false;
  return reliabilityScore >= DISCOVERY_THRESHOLDS.MIN_RELIABILITY_SCORE;
}

/** Evaluate a single trial feed */
export async function evaluateTrialFeed(
  feed: FeedConfig,
  db: D1Database
): Promise<EvaluationResult> {
  const stats = await db
    .prepare(
      `SELECT error_count_1h as error_count, success_count_1h as success_count,
              trial_start_at FROM feeds WHERE id = ?1`
    )
    .bind(feed.id)
    .first<{ error_count: number; success_count: number; trial_start_at: string }>();

  if (!stats) {
    return { feed_id: feed.id, action: "reject", reliability_score: 0, reason: "Feed not found" };
  }

  const totalPolls = stats.success_count + stats.error_count;
  const reliability = totalPolls > 0 ? stats.success_count / totalPolls : 0;

  const trialStart = stats.trial_start_at ? new Date(stats.trial_start_at).getTime() : 0;
  const trialHours = (Date.now() - trialStart) / 3600_000;

  if (trialHours < 24 && totalPolls < DISCOVERY_THRESHOLDS.TRIAL_POLL_COUNT) {
    return { feed_id: feed.id, action: "continue", reliability_score: reliability, reason: "Trial in progress" };
  }

  if (shouldActivate(reliability, stats.success_count, stats.error_count)) {
    await updateFeedStatus(db, feed.id, "active");
    await updateFeedReliability(db, feed.id, reliability);
    return { feed_id: feed.id, action: "activate", reliability_score: reliability, reason: "Reliable feed, activated" };
  }

  await updateFeedStatus(db, feed.id, "inactive");
  return { feed_id: feed.id, action: "reject", reliability_score: reliability, reason: `Low reliability: ${(reliability * 100).toFixed(1)}%` };
}

/** Evaluate all trial feeds */
export async function evaluateAllTrials(db: D1Database): Promise<EvaluationResult[]> {
  const trials = await getTrialFeeds(db);
  const results: EvaluationResult[] = [];

  for (const feed of trials) {
    const result = await evaluateTrialFeed(feed, db);
    results.push(result);
  }

  return results;
}
