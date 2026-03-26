import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

export async function GET() {
  const { env } = await getCloudflareContext();

  let dbStatus = "ok";
  let feedSummary = { active: 0, trial: 0, degraded: 0, inactive: 0 };

  try {
    const feedRows = await env.DB
      .prepare("SELECT status, COUNT(*) as count FROM feeds GROUP BY status")
      .all<{ status: string; count: number }>();

    for (const row of feedRows.results) {
      if (row.status === "active") feedSummary.active = row.count;
      else if (row.status === "trial") feedSummary.trial = row.count;
      else if (row.status === "degraded") feedSummary.degraded = row.count;
      else if (row.status === "inactive" || row.status === "dormant") feedSummary.inactive += row.count;
    }
  } catch {
    dbStatus = "error";
  }

  const health = {
    status: dbStatus === "ok" ? "ok" : "degraded",
    version: "0.2.0",
    timestamp: new Date().toISOString(),
    services: {
      api: "ok",
      database: dbStatus,
      feeds: feedSummary.active > 0 ? "ok" : "no-feeds",
    },
    feeds: feedSummary,
  };

  const statusCode = health.status === "ok" ? 200 : 503;
  return NextResponse.json(health, {
    status: statusCode,
    headers: { "Cache-Control": "public, max-age=10" },
  });
}
