import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirport, getRecentReadings, getRollupData, getAirportRollupSummary } from "@/lib/db/d1";


export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { env } = await getCloudflareContext();
  const url = new URL(request.url);
  const hours = Math.max(1, Number(url.searchParams.get("hours")) || 24);
  const days = Number(url.searchParams.get("days")) || 0;
  const checkpoint = url.searchParams.get("checkpoint") || undefined;

  const airport = await getAirport(env.DB, code);
  if (!airport) {
    return NextResponse.json({ error: "Airport not found" }, { status: 404 });
  }

  // If requesting > 7 days (or explicit days param), use rollup data
  if (days > 0 || hours > 168) {
    const daysBack = days > 0 ? Math.min(365, days) : Math.min(365, Math.ceil(hours / 24));
    const [rollup, summary] = await Promise.all([
      getRollupData(env.DB, code, daysBack, checkpoint),
      getAirportRollupSummary(env.DB, code, daysBack),
    ]);

    return NextResponse.json({
      airport_code: airport.iata,
      period: `${daysBack}d`,
      source: "rollup",
      summary,
      count: rollup.length,
      data: rollup,
    }, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  // Short-term: raw readings (up to 7 days)
  const cappedHours = Math.min(168, hours);
  const readings = await getRecentReadings(env.DB, code, cappedHours);

  return NextResponse.json({
    airport_code: airport.iata,
    hours_back: cappedHours,
    source: "raw",
    count: readings.length,
    readings,
  }, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
