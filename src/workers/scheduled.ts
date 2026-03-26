// src/workers/scheduled.ts
import { pollFeeds } from "./ingestion/poll-feeds";
import { runDiscoveryScan } from "./discovery/scanner";
import { evaluateAllTrials } from "./discovery/validator";
import { runHealthCheck } from "./health/monitor";
import { runSelfHeal } from "./health/self-heal";

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
      // Every 5 minutes: evaluate trial feeds + predictions (Plan 4)
      await evaluateAllTrials(env.DB);
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

  const cutoff = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  await db.prepare("DELETE FROM readings WHERE ingested_at < ?1").bind(cutoff).run();

  const predCutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  await db.prepare("DELETE FROM predictions WHERE generated_at < ?1").bind(predCutoff).run();
}
