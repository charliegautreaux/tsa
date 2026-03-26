import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirport, getCheckpoints, getCurrentWaits } from "@/lib/db/d1";
import { getCachedAirportLive, cacheAirportLive } from "@/lib/db/kv";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { env } = await getCloudflareContext();

  // Try KV cache first (30s TTL)
  const cached = await getCachedAirportLive(env.CACHE, code);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, max-age=10", "X-Cache": "HIT" },
    });
  }

  const airport = await getAirport(env.DB, code);
  if (!airport) {
    return NextResponse.json({ error: "Airport not found" }, { status: 404 });
  }

  const [checkpoints, currentWaits] = await Promise.all([
    getCheckpoints(env.DB, code),
    getCurrentWaits(env.DB, code),
  ]);

  // Group waits by checkpoint
  const checkpointData = checkpoints.map((cp) => {
    const waits = currentWaits.filter((w) => w.checkpoint_id === cp.id);
    const lanes: Record<string, unknown> = {};
    for (const w of waits) {
      lanes[w.lane_type] = {
        wait_minutes: w.wait_minutes,
        trend: w.trend,
        confidence: w.confidence,
        source: w.source_type,
      };
    }
    return {
      id: cp.id,
      name: cp.name,
      terminal: cp.terminal,
      status: cp.status,
      lanes,
      updated_at: waits[0]?.updated_at ?? null,
    };
  });

  const response = {
    airport: {
      code: airport.iata,
      name: airport.name,
      city: airport.city,
      state: airport.state,
      data_tier: airport.data_tier,
    },
    checkpoints: checkpointData,
    meta: {
      data_tier: airport.data_tier,
      sources_active: new Set(currentWaits.map((w) => w.source_type)).size,
      generated_at: new Date().toISOString(),
    },
  };

  await cacheAirportLive(env.CACHE, code, response);

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, max-age=10", "X-Cache": "MISS" },
  });
}
