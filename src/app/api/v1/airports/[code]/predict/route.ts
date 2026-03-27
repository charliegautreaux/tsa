import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirport, getPredictions, getCheckpoints } from "@/lib/db/d1";


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { env } = await getCloudflareContext();

  const airport = await getAirport(env.DB, code);
  if (!airport) {
    return NextResponse.json({ error: "Airport not found" }, { status: 404 });
  }

  const [checkpoints, predictions] = await Promise.all([
    getCheckpoints(env.DB, code),
    getPredictions(env.DB, code),
  ]);

  // Group predictions by checkpoint + lane
  const grouped: Record<string, Record<string, { time: string; predicted_wait: number; confidence: number }[]>> = {};
  for (const pred of predictions) {
    const key = pred.checkpoint_id;
    if (!grouped[key]) grouped[key] = {};
    if (!grouped[key][pred.lane_type]) grouped[key][pred.lane_type] = [];
    grouped[key][pred.lane_type].push({
      time: pred.forecast_time,
      predicted_wait: pred.predicted_wait,
      confidence: pred.confidence,
    });
  }

  const result = checkpoints.map((cp) => ({
    checkpoint_id: cp.id,
    checkpoint_name: cp.name,
    forecast: grouped[cp.id] ?? {},
  }));

  return NextResponse.json({
    airport_code: airport.iata,
    forecast_horizon: "4h",
    interval: "15min",
    checkpoints: result,
    generated_at: new Date().toISOString(),
  }, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
