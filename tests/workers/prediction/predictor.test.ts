import { describe, it, expect } from "vitest";
import { calculatePrediction, clampWait } from "@/workers/prediction/predictor";
import type { HistoricalPattern, WeatherImpact } from "@/lib/types/prediction";

describe("clampWait", () => {
  it("clamps negative values to 0", () => {
    expect(clampWait(-5)).toBe(0);
  });

  it("clamps high values to 180", () => {
    expect(clampWait(250)).toBe(180);
  });

  it("rounds to 1 decimal", () => {
    expect(clampWait(45.678)).toBe(45.7);
  });
});

describe("calculatePrediction", () => {
  const patterns: HistoricalPattern[] = [
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 8, avg_wait: 40, sample_count: 20 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 9, avg_wait: 50, sample_count: 18 },
  ];

  const weather: WeatherImpact = {
    airport_code: "ATL",
    condition: "Clear",
    impact_factor: 1.0,
    fetched_at: new Date().toISOString(),
  };

  it("produces prediction from historical + weather", () => {
    const result = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });
    expect(result.predicted_wait).toBeGreaterThan(30);
    expect(result.predicted_wait).toBeLessThan(60);
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("applies weather multiplier", () => {
    const stormWeather: WeatherImpact = { ...weather, condition: "Thunderstorm", impact_factor: 1.4 };

    const clear = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });

    const storm = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather: stormWeather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });

    expect(storm.predicted_wait).toBeGreaterThan(clear.predicted_wait);
  });

  it("incorporates crowd correction", () => {
    const withoutCrowd = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });

    const withCrowd = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: 60,
      hasDisruption: false,
    });

    expect(withCrowd.predicted_wait).toBeGreaterThan(withoutCrowd.predicted_wait);
  });

  it("applies disruption boost", () => {
    const normal = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });

    const disrupted = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: true,
    });

    expect(disrupted.predicted_wait).toBeGreaterThan(normal.predicted_wait);
  });
});
