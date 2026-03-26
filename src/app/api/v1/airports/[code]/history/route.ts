import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirport, getRecentReadings } from "@/lib/db/d1";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { env } = await getCloudflareContext();
  const url = new URL(request.url);
  const hours = Math.min(72, Math.max(1, Number(url.searchParams.get("hours")) || 24));

  const airport = await getAirport(env.DB, code);
  if (!airport) {
    return NextResponse.json({ error: "Airport not found" }, { status: 404 });
  }

  const readings = await getRecentReadings(env.DB, code, hours);

  return NextResponse.json({
    airport_code: airport.iata,
    hours_back: hours,
    count: readings.length,
    readings,
  }, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
