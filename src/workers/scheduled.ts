// src/workers/scheduled.ts
import { pollFeeds } from "./ingestion/poll-feeds";
import { runDiscoveryScan } from "./discovery/scanner";
import { evaluateAllTrials } from "./discovery/validator";
import { runHealthCheck } from "./health/monitor";
import { runSelfHeal } from "./health/self-heal";
import { runPredictions } from "./prediction/run-predictions";

export async function handleScheduled(
  event: ScheduledEvent,
  env: CloudflareEnv
): Promise<void> {
  const cron = event.cron;

  switch (cron) {
    case "* * * * *":
      // Every minute: poll feeds + health check
      await pollFeeds(env.DB, env.CACHE, env as unknown as Record<string, unknown>);
      await runHealthCheck(env.DB);
      break;

    case "*/5 * * * *":
      // Every 5 minutes: evaluate trial feeds + run predictions
      await evaluateAllTrials(env.DB);
      await runPredictions(env.DB);
      break;

    case "0 * * * *":
      // Every hour: maintenance + self-heal
      await hourlyMaintenance(env.DB);
      await runSelfHeal(env.DB, env as unknown as Record<string, unknown>);
      break;

    case "0 */6 * * *":
      // Every 6 hours: discovery scan
      await runDiscoveryScan(env.DB);
      break;

    default:
      console.log(`Unknown cron: ${cron}`);
  }
}

async function hourlyMaintenance(db: D1Database): Promise<void> {
  await db
    .prepare("UPDATE feeds SET error_count_1h = 0, success_count_1h = 0 WHERE status IN ('active', 'trial', 'degraded')")
    .run();

  // Roll up readings older than 6 hours into hourly aggregates BEFORE deleting
  const rollupCutoff = new Date(Date.now() - 6 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
  const deleteCutoff = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().replace("T", " ").slice(0, 19);

  await db
    .prepare(`
      INSERT OR REPLACE INTO readings_rollup (airport_code, checkpoint_id, lane_type, hour, avg_wait, min_wait, max_wait, sample_count, source_types)
      SELECT
        airport_code,
        checkpoint_id,
        lane_type,
        substr(measured_at, 1, 13) || ':00' as hour,
        ROUND(AVG(wait_minutes), 1) as avg_wait,
        ROUND(MIN(wait_minutes), 1) as min_wait,
        ROUND(MAX(wait_minutes), 1) as max_wait,
        COUNT(*) as sample_count,
        GROUP_CONCAT(DISTINCT source_type) as source_types
      FROM readings
      WHERE measured_at < ?1 AND source_type != 'predicted'
      GROUP BY airport_code, checkpoint_id, lane_type, substr(measured_at, 1, 13)
    `)
    .bind(rollupCutoff)
    .run();

  // Now safe to delete old raw readings
  await db.prepare("DELETE FROM readings WHERE ingested_at < ?1").bind(deleteCutoff).run();

  const predCutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  await db.prepare("DELETE FROM predictions WHERE generated_at < ?1").bind(predCutoff).run();
}
