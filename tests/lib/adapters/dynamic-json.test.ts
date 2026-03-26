import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dynamicJsonAdapter } from "@/lib/adapters/dynamic-json";
import type { FeedConfig } from "@/lib/types/feed";

const mockConfig: FeedConfig = {
  id: "atl-sensor-1",
  airport_code: "ATL",
  checkpoint_id: "atl-main",
  type: "sensor-api",
  adapter: "dynamic-json",
  url: "https://example.com/api/wait-times",
  auth_config: { type: "none" },
  polling_interval_sec: 60,
  dynamic_mapping: {
    wait_minutes: "$.data.checkpoints[*].waitTime",
    checkpoint: "$.data.checkpoints[*].name",
    lane_type: "$.data.checkpoints[*].laneType",
    measured_at: "$.data.lastUpdated",
  },
  status: "active",
  reliability_score: 0.8,
  discovered_by: "known-pattern",
};

describe("dynamicJsonAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has correct id", () => {
    expect(dynamicJsonAdapter.id).toBe("dynamic-json");
  });

  it("fetches and maps JSON using dynamic mapping", async () => {
    const mockResponse = {
      data: {
        lastUpdated: "2026-03-26T10:00:00Z",
        checkpoints: [
          { name: "Main", waitTime: 25, laneType: "standard" },
          { name: "Main", waitTime: 10, laneType: "precheck" },
        ],
      },
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const readings = await dynamicJsonAdapter.fetch(mockConfig, {});
    expect(readings).toHaveLength(2);
    expect(readings[0].wait_minutes).toBe(25);
    expect(readings[0].checkpoint_id).toBe("atl-main");
    expect(readings[0].lane_type).toBe("standard");
    expect(readings[1].wait_minutes).toBe(10);
    expect(readings[1].lane_type).toBe("precheck");
  });

  it("returns empty array on fetch error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });
    const readings = await dynamicJsonAdapter.fetch(mockConfig, {});
    expect(readings).toHaveLength(0);
  });

  it("returns empty array when no mapping configured", async () => {
    const noMapping = { ...mockConfig, dynamic_mapping: null };
    const readings = await dynamicJsonAdapter.fetch(noMapping, {});
    expect(readings).toHaveLength(0);
  });
});
