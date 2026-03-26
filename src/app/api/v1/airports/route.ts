import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAllAirports } from "@/lib/db/d1";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext();
    const airports = await getAllAirports(env.DB);

    return NextResponse.json({
      count: airports.length,
      airports,
    });
  } catch (error) {
    // Fallback for local dev without D1
    return NextResponse.json({
      count: 0,
      airports: [],
      error: "Database not available",
    });
  }
}
