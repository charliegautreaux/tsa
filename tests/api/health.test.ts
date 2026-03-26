import { describe, it, expect, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({
    env: {
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { status: "active", count: 3 },
              { status: "trial", count: 1 },
            ],
          }),
        }),
      },
    },
  }),
}));

import { GET } from "@/app/api/v1/health/route";

describe("GET /api/v1/health", () => {
  it("returns ok status", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.2.0");
    expect(body.timestamp).toBeDefined();
    expect(body.services.api).toBe("ok");
    expect(body.services.database).toBe("ok");
    expect(body.services.feeds).toBe("ok");
    expect(body.feeds.active).toBe(3);
    expect(body.feeds.trial).toBe(1);
  });

  it("returns degraded status when DB errors", async () => {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    vi.mocked(getCloudflareContext).mockResolvedValueOnce({
      env: {
        DB: {
          prepare: vi.fn().mockReturnValue({
            all: vi.fn().mockRejectedValue(new Error("DB error")),
          }),
        },
      },
    } as unknown as Awaited<ReturnType<typeof getCloudflareContext>>);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.services.database).toBe("error");
  });
});
