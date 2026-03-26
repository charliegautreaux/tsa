import { pollFeeds } from "./ingestion/poll-feeds";

export async function handleScheduled(
  event: ScheduledEvent,
  env: CloudflareEnv
): Promise<void> {
  const cron = event.cron;

  switch (cron) {
    case "* * * * *":
      // Every minute: poll all active feeds
      await pollFeeds(env.DB, env.CACHE, env as unknown as Record<string, unknown>);
      break;

    case "*/5 * * * *":
      // Every 5 minutes: update predictions (Plan 4)
      break;

    case "0 * * * *":
      // Every hour: maintenance
      await hourlyMaintenance(env.DB);
      break;

    case "0 */6 * * *":
      // Every 6 hours: feed discovery (Plan 3)
      break;

    default:
      console.log(`Unknown cron: ${cron}`);
  }
}

async function hourlyMaintenance(db: D1Database): Promise<void> {
  // Reset 1h rolling counters
  await db
    .prepare("UPDATE feeds SET error_count_1h = 0, success_count_1h = 0 WHERE status IN ('active', 'trial', 'degraded')")
    .run();

  // Prune old readings (keep last 7 days)
  const cutoff = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  await db
    .prepare("DELETE FROM readings WHERE ingested_at < ?1")
    .bind(cutoff)
    .run();

  // Prune old predictions
  const predCutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  await db
    .prepare("DELETE FROM predictions WHERE generated_at < ?1")
    .bind(predCutoff)
    .run();
}
