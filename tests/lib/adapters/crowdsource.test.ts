import { describe, it, expect, vi } from "vitest";
import { crowdsourceAdapter } from "@/lib/adapters/crowdsource";
import type { FeedConfig } from "@/lib/types/feed";

const mockConfig: FeedConfig = {
  id: "atl-crowd",
  airport_code: "ATL",
  checkpoint_id: null,
  type: "crowdsourced",
  adapter: "crowdsource",
  url: null,
  auth_config: { type: "none" },
  polling_interval_sec: 60,
  dynamic_mapping: null,
  status: "active",
  reliability_score: 0.7,
  discovered_by: "manual",
};

describe("crowdsourceAdapter", () => {
  it("has correct id", () => {
    expect(crowdsourceAdapter.id).toBe("crowdsource");
  });

  it("fetches recent reports from D1 and converts to readings", async () => {
    const now = new Date().toISOString();
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { airport_code: "ATL", checkpoint: "Main", lane_type: "standard", wait_minutes: 30, created_at: now },
              { airport_code: "ATL", checkpoint: "South", lane_type: "precheck", wait_minutes: 15, created_at: now },
            ],
          }),
        }),
      }),
    };

    const readings = await crowdsourceAdapter.fetch(mockConfig, { DB: mockDb });
    expect(readings).toHaveLength(2);
    expect(readings[0].airport_code).toBe("ATL");
    expect(readings[0].source_type).toBe("crowdsourced");
    expect(readings[0].confidence).toBe(0.7);
    expect(readings[0].wait_minutes).toBe(30);
    expect(readings[1].lane_type).toBe("precheck");
  });

  it("returns empty array when no recent reports", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    };
    const readings = await crowdsourceAdapter.fetch(mockConfig, { DB: mockDb });
    expect(readings).toHaveLength(0);
  });

  it("health check returns healthy when DB is accessible", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 5 }),
        }),
      }),
    };
    const health = await crowdsourceAdapter.healthCheck(mockConfig, { DB: mockDb });
    expect(health.is_healthy).toBe(true);
    expect(health.feed_id).toBe("atl-crowd");
  });
});
