import { describe, it, expect } from "vitest";
import { getBaseWait, interpolateHour, DEFAULT_WAIT_MINUTES } from "@/workers/prediction/historical";
import type { HistoricalPattern } from "@/lib/types/prediction";

describe("getBaseWait", () => {
  const patterns: HistoricalPattern[] = [
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 8, avg_wait: 45, sample_count: 20 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 9, avg_wait: 55, sample_count: 18 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 14, avg_wait: 25, sample_count: 15 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "precheck", day_of_week: 1, hour: 8, avg_wait: 15, sample_count: 12 },
  ];

  it("returns exact match when available", () => {
    const result = getBaseWait(patterns, "atl-main", "standard", 1, 8);
    expect(result).toBe(45);
  });

  it("interpolates between hours", () => {
    const result = getBaseWait(patterns, "atl-main", "standard", 1, 8.5);
    expect(result).toBe(50);
  });

  it("returns default when no pattern found", () => {
    const result = getBaseWait(patterns, "atl-main", "standard", 3, 8);
    expect(result).toBe(DEFAULT_WAIT_MINUTES);
  });

  it("matches lane type correctly", () => {
    const result = getBaseWait(patterns, "atl-main", "precheck", 1, 8);
    expect(result).toBe(15);
  });
});

describe("interpolateHour", () => {
  it("returns exact value at whole hour", () => {
    expect(interpolateHour(45, 55, 0)).toBe(45);
  });

  it("returns midpoint at 0.5", () => {
    expect(interpolateHour(45, 55, 0.5)).toBe(50);
  });

  it("returns end value at 1.0", () => {
    expect(interpolateHour(45, 55, 1.0)).toBe(55);
  });
});
