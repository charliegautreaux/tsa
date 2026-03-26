import { describe, it, expect } from "vitest";
import { generateForecast, findBestTime } from "@/workers/prediction/forecast";
import type { HistoricalPattern, WeatherImpact, ForecastPoint } from "@/lib/types/prediction";

describe("generateForecast", () => {
  const patterns: HistoricalPattern[] = [
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 8, avg_wait: 45, sample_count: 20 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 9, avg_wait: 55, sample_count: 18 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 10, avg_wait: 40, sample_count: 15 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 11, avg_wait: 30, sample_count: 12 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 12, avg_wait: 25, sample_count: 10 },
  ];

  const weather: WeatherImpact = {
    airport_code: "ATL",
    condition: "Clear",
    impact_factor: 1.0,
    fetched_at: new Date().toISOString(),
  };

  it("generates 16 forecast points (4h x 15min intervals)", () => {
    const now = new Date("2026-03-26T08:00:00Z");
    const result = generateForecast({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      now,
      hasDisruption: false,
    });
    expect(result.length).toBe(16);
  });

  it("forecast points have increasing timestamps", () => {
    const now = new Date("2026-03-26T08:00:00Z");
    const result = generateForecast({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      now,
      hasDisruption: false,
    });
    for (let i = 1; i < result.length; i++) {
      expect(new Date(result[i].time).getTime()).toBeGreaterThan(new Date(result[i - 1].time).getTime());
    }
  });
});

describe("findBestTime", () => {
  it("finds the lowest wait window", () => {
    const points: ForecastPoint[] = [
      { time: "2026-03-26T08:00:00Z", predicted_wait: 40, confidence: 0.5 },
      { time: "2026-03-26T08:15:00Z", predicted_wait: 45, confidence: 0.5 },
      { time: "2026-03-26T08:30:00Z", predicted_wait: 20, confidence: 0.5 },
      { time: "2026-03-26T08:45:00Z", predicted_wait: 15, confidence: 0.5 },
      { time: "2026-03-26T09:00:00Z", predicted_wait: 18, confidence: 0.5 },
      { time: "2026-03-26T09:15:00Z", predicted_wait: 35, confidence: 0.5 },
    ];

    const result = findBestTime(points);
    expect(result).not.toBeNull();
    expect(result!.predicted_wait).toBeLessThanOrEqual(20);
    expect(result!.start).toBe("2026-03-26T08:30:00Z");
  });

  it("returns null for empty forecast", () => {
    expect(findBestTime([])).toBeNull();
  });
});
