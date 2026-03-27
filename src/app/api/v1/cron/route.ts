import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { pollFeeds } from "@/workers/ingestion/poll-feeds";
import { runPredictions } from "@/workers/prediction/run-predictions";
import { runHealthCheck } from "@/workers/health/monitor";

/**
 * Internal cron endpoint — called by Cloudflare cron triggers or manually.
 * Protected by a shared secret in the Authorization header.
 */
export async function GET(request: Request) {
  const { env } = await getCloudflareContext();

  // Simple auth check — only allow internal calls or requests with the cron secret
  const authHeader = request.headers.get("Authorization");
  const cronSecret = (env as unknown as Record<string, string>).CRON_SECRET;
  const url = new URL(request.url);
  const trigger = url.searchParams.get("trigger") ?? "poll";

  // Allow if no secret is configured (dev), or if the secret matches
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    switch (trigger) {
      case "poll": {
        const pollResult = await pollFeeds(
          env.DB,
          env.CACHE,
          env as unknown as Record<string, unknown>
        );
        await runHealthCheck(env.DB);
        return NextResponse.json({
          trigger: "poll",
          ...pollResult,
          timestamp: new Date().toISOString(),
        });
      }

      case "predict": {
        await runPredictions(env.DB);
        return NextResponse.json({
          trigger: "predict",
          status: "ok",
          timestamp: new Date().toISOString(),
        });
      }

      case "all": {
        const pollResult = await pollFeeds(
          env.DB,
          env.CACHE,
          env as unknown as Record<string, unknown>
        );
        await runHealthCheck(env.DB);
        await runPredictions(env.DB);
        return NextResponse.json({
          trigger: "all",
          poll: pollResult,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown trigger: ${trigger}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
