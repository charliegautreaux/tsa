import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirport, getCheckpoints, getCurrentWaits } from "@/lib/db/d1";


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { env } = await getCloudflareContext();

    const airport = await getAirport(env.DB, code);
    if (!airport) {
      return NextResponse.json({ error: "Airport not found" }, { status: 404 });
    }

    const [checkpoints, currentWaits] = await Promise.all([
      getCheckpoints(env.DB, code),
      getCurrentWaits(env.DB, code),
    ]);

    return NextResponse.json({
      airport,
      checkpoints,
      current_waits: currentWaits,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch airport data" },
      { status: 500 }
    );
  }
}
