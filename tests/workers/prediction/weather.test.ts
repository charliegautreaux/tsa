import { describe, it, expect, vi, afterEach } from "vitest";
import { getWeatherImpact, conditionToFactor } from "@/workers/prediction/weather";

describe("conditionToFactor", () => {
  it("returns 1.0 for clear conditions", () => {
    expect(conditionToFactor("Clear")).toBe(1.0);
    expect(conditionToFactor("Few Clouds")).toBe(1.0);
  });

  it("returns higher factor for storms", () => {
    expect(conditionToFactor("Thunderstorm")).toBeGreaterThan(1.2);
  });

  it("returns moderate factor for rain", () => {
    const factor = conditionToFactor("Rain");
    expect(factor).toBeGreaterThan(1.0);
    expect(factor).toBeLessThan(1.3);
  });

  it("returns high factor for snow/ice", () => {
    expect(conditionToFactor("Snow")).toBeGreaterThan(1.3);
  });

  it("handles unknown conditions as neutral", () => {
    expect(conditionToFactor("Unknown")).toBe(1.0);
  });
});

describe("getWeatherImpact", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("fetches weather and returns impact factor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        properties: {
          textDescription: "Thunderstorm",
        },
      }),
    }));

    const result = await getWeatherImpact("ATL");
    expect(result.impact_factor).toBeGreaterThan(1.2);
    expect(result.condition).toBe("Thunderstorm");
  });

  it("returns neutral on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await getWeatherImpact("ATL");
    expect(result.impact_factor).toBe(1.0);
    expect(result.condition).toBe("unknown");
  });
});
