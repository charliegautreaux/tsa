import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { probeUrl, scoreResponse } from "@/workers/discovery/scanner";

describe("scoreResponse", () => {
  it("scores valid wait time JSON highly", () => {
    const json = {
      checkpoints: [
        { name: "Main", waitTime: 25, laneType: "standard" },
      ],
    };
    const score = scoreResponse(json);
    expect(score).toBeGreaterThan(0.7);
  });

  it("scores irrelevant JSON low", () => {
    const json = { menu: "food", price: 12.99 };
    const score = scoreResponse(json);
    expect(score).toBeLessThan(0.3);
  });

  it("scores empty response as 0", () => {
    expect(scoreResponse(null)).toBe(0);
    expect(scoreResponse({})).toBeLessThan(0.3);
  });
});

describe("probeUrl", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns probe result for valid endpoint", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      headers: new Map([["content-type", "application/json"]]),
      json: () => Promise.resolve({
        checkpoints: [{ name: "Main", waitTime: 15 }],
      }),
    });

    const result = await probeUrl("https://example.com/api/wait-times", "ATL");
    expect(result.reachable).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it("returns failed probe for unreachable URL", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    const result = await probeUrl("https://example.com/bad", "ATL");
    expect(result.reachable).toBe(false);
    expect(result.score).toBe(0);
  });
});
