import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAllAirports } from "@/lib/db/d1";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext();

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase();

    let airports = await getAllAirports(env.DB);

    if (q) {
      airports = airports.filter(
        (a) =>
          a.iata.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.city && a.city.toLowerCase().includes(q)) ||
          (a.state && a.state.toLowerCase().includes(q))
      );
    }

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
