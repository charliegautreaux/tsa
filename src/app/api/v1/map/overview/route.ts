import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirportOverview } from "@/lib/db/d1";

export const runtime = "edge";

export async function GET() {
  try {
    const { env } = await getCloudflareContext();

    // Try KV cache first
    const cached = await env.CACHE.get("map:overview", "json");
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT" },
      });
    }

    const airports = await getAirportOverview(env.DB);
    const response = {
      count: airports.length,
      airports,
      generated_at: new Date().toISOString(),
    };

    // Cache for 30 seconds
    await env.CACHE.put("map:overview", JSON.stringify(response), {
      expirationTtl: 30,
    });

    return NextResponse.json(response, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    return NextResponse.json({
      count: 0,
      airports: [],
      error: "Database not available",
    });
  }
}
