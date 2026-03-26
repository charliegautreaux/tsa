import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const health = {
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    services: {
      api: "ok",
      database: "pending",
      feeds: "pending",
    },
  };

  return NextResponse.json(health);
}
