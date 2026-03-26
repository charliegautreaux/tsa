import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { insertReport } from "@/lib/db/d1";
import { validateReport } from "@/lib/utils/validation";

export const runtime = "edge";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  // Validate
  const validation = validateReport(input as any);
  if (!validation.valid) {
    return NextResponse.json({ error: "Validation failed", details: validation.error }, { status: 400 });
  }

  // Rate limiting
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = await hashIP(ip);

  const rateCheck = await env.DB
    .prepare("SELECT report_count, window_start FROM report_rate_limits WHERE ip_hash = ?1")
    .bind(ipHash)
    .first<{ report_count: number; window_start: string }>();

  if (rateCheck) {
    const windowAge = Date.now() - new Date(rateCheck.window_start).getTime();
    if (windowAge < 3600_000 && rateCheck.report_count >= 10) {
      return NextResponse.json({ error: "Rate limit exceeded (10 reports per hour)" }, { status: 429 });
    }
    if (windowAge >= 3600_000) {
      await env.DB.prepare("UPDATE report_rate_limits SET report_count = 1, window_start = datetime('now') WHERE ip_hash = ?1").bind(ipHash).run();
    } else {
      await env.DB.prepare("UPDATE report_rate_limits SET report_count = report_count + 1 WHERE ip_hash = ?1").bind(ipHash).run();
    }
  } else {
    await env.DB.prepare("INSERT INTO report_rate_limits (ip_hash, report_count) VALUES (?1, 1)").bind(ipHash).run();
  }

  const id = crypto.randomUUID();
  await insertReport(env.DB, {
    id,
    airport_code: (input.airport_code as string).toUpperCase(),
    checkpoint: input.checkpoint as string,
    lane_type: input.lane_type as string,
    wait_minutes: input.wait_minutes as number,
    note: (input.note as string) ?? null,
    lat: (input.lat as number) ?? null,
    lng: (input.lng as number) ?? null,
    ip_hash: ipHash,
  });

  return NextResponse.json({ id, status: "accepted" }, { status: 201 });
}

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "preboard-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
