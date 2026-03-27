import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirport, getCheckpoints, getCurrentWaits } from "@/lib/db/d1";


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

  const [checkpoints, waits] = await Promise.all([
    getCheckpoints(env.DB, code),
    getCurrentWaits(env.DB, code),
  ]);

  const result = checkpoints.map((cp) => ({
    ...cp,
    current_waits: waits.filter((w) => w.checkpoint_id === cp.id),
  }));

  return NextResponse.json({
    airport_code: airport.iata,
    checkpoints: result,
  }, {
    headers: { "Cache-Control": "public, max-age=30" },
  });
}
