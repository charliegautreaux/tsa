import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getWorstAirports } from "@/lib/db/d1";

export const runtime = "edge";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext();
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));

  const airports = await getWorstAirports(env.DB, limit);

  return NextResponse.json({
    count: airports.length,
    airports,
    generated_at: new Date().toISOString(),
  }, {
    headers: { "Cache-Control": "public, max-age=30" },
  });
}
