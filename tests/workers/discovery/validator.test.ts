import { describe, it, expect, vi } from "vitest";
import { evaluateTrialFeed, shouldActivate } from "@/workers/discovery/validator";

describe("shouldActivate", () => {
  it("activates when reliability is high enough", () => {
    expect(shouldActivate(0.8, 200, 10)).toBe(true);
  });

  it("rejects when reliability is too low", () => {
    expect(shouldActivate(0.5, 200, 100)).toBe(false);
  });

  it("rejects when not enough polls", () => {
    expect(shouldActivate(0.9, 5, 0)).toBe(false);
  });
});

describe("evaluateTrialFeed", () => {
  it("activates feed that meets threshold", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            error_count: 5,
            success_count: 250,
            trial_start_at: new Date(Date.now() - 25 * 3600_000).toISOString(),
          }),
          run: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    const feed = {
      id: "test-feed",
      airport_code: "ATL",
      checkpoint_id: null,
      type: "airport-web" as const,
      adapter: "airport-json" as const,
      url: "https://example.com",
      auth_config: { type: "none" as const },
      polling_interval_sec: 300,
      dynamic_mapping: null,
      status: "trial" as const,
      reliability_score: 0,
      discovered_by: "known-pattern" as const,
    };

    const result = await evaluateTrialFeed(feed, mockDb as unknown as D1Database);
    expect(result.action).toBe("activate");
  });
});
