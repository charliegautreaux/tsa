import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { airportJsonAdapter } from "@/lib/adapters/airport-json";
import type { FeedConfig } from "@/lib/types/feed";

const mockConfig: FeedConfig = {
  id: "den-json",
  airport_code: "DEN",
  checkpoint_id: null,
  type: "airport-web",
  adapter: "airport-json",
  url: "https://flydenver.com/api/security/wait-times",
  auth_config: { type: "none" },
  polling_interval_sec: 60,
  dynamic_mapping: null,
  status: "active",
  reliability_score: 0.85,
  discovered_by: "known-pattern",
};

describe("airportJsonAdapter", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("has correct id", () => {
    expect(airportJsonAdapter.id).toBe("airport-json");
  });

  it("parses waits object format", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        checkpoints: [{
          name: "North Security",
          waits: { general: 22, precheck: 8, clear: 3 },
          updated: "2026-03-26T10:00:00Z",
        }],
      }),
    });
    const readings = await airportJsonAdapter.fetch(mockConfig, {});
    expect(readings.length).toBeGreaterThanOrEqual(1);
    expect(readings[0].airport_code).toBe("DEN");
    expect(readings[0].source_type).toBe("airport-api");
  });

  it("parses lanes array format", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        checkpoints: [{
          name: "Main",
          lanes: [{ type: "standard", wait: 15 }, { type: "precheck", wait: 5 }],
          timestamp: "2026-03-26T10:00:00Z",
        }],
      }),
    });
    const readings = await airportJsonAdapter.fetch(mockConfig, {});
    expect(readings).toHaveLength(2);
  });

  it("returns empty array on network error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
    const readings = await airportJsonAdapter.fetch(mockConfig, {});
    expect(readings).toHaveLength(0);
  });

  it("returns empty when no URL", async () => {
    const noUrl = { ...mockConfig, url: null };
    const readings = await airportJsonAdapter.fetch(noUrl, {});
    expect(readings).toHaveLength(0);
  });
});
