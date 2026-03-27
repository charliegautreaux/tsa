import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getNationalStats } from "@/lib/db/d1";


export async function GET() {
  const { env } = await getCloudflareContext();
  const stats = await getNationalStats(env.DB);

  return NextResponse.json({
    ...stats,
    generated_at: new Date().toISOString(),
  }, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
