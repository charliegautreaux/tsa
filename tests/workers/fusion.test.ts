import { describe, it, expect } from "vitest";
import { fuseReadings } from "@/workers/ingestion/fusion";
import type { RawReading } from "@/lib/adapters/base";

function makeReading(overrides: Partial<RawReading>): RawReading {
  return {
    airport_code: "ATL",
    checkpoint_id: "atl-main",
    lane_type: "standard",
    wait_minutes: 20,
    confidence: 0.8,
    source_type: "airport-api",
    measured_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("fuseReadings", () => {
  it("returns empty for no readings", () => {
    expect(fuseReadings([])).toHaveLength(0);
  });

  it("returns single reading unchanged", () => {
    const readings = [makeReading({ wait_minutes: 25 })];
    const fused = fuseReadings(readings);
    expect(fused).toHaveLength(1);
    expect(fused[0].wait_minutes).toBe(25);
  });

  it("prefers sensor data over other sources", () => {
    const readings = [
      makeReading({ wait_minutes: 20, source_type: "airport-api", confidence: 0.85 }),
      makeReading({ wait_minutes: 25, source_type: "sensor", confidence: 0.95 }),
    ];
    const fused = fuseReadings(readings);
    expect(fused).toHaveLength(1);
    expect(fused[0].wait_minutes).toBe(25);
    expect(fused[0].source_type).toBe("sensor");
  });

  it("prefers airport-api over crowdsourced", () => {
    const readings = [
      makeReading({ wait_minutes: 30, source_type: "crowdsourced", confidence: 0.7 }),
      makeReading({ wait_minutes: 25, source_type: "airport-api", confidence: 0.85 }),
    ];
    const fused = fuseReadings(readings);
    expect(fused).toHaveLength(1);
    expect(fused[0].wait_minutes).toBe(25);
  });

  it("boosts confidence when sensor + crowd agree", () => {
    const readings = [
      makeReading({ wait_minutes: 25, source_type: "sensor", confidence: 0.95 }),
      makeReading({ wait_minutes: 27, source_type: "crowdsourced", confidence: 0.7 }),
    ];
    const fused = fuseReadings(readings);
    expect(fused[0].confidence).toBeGreaterThan(0.95);
  });

  it("groups by checkpoint + lane type", () => {
    const readings = [
      makeReading({ checkpoint_id: "atl-main", lane_type: "standard", wait_minutes: 25 }),
      makeReading({ checkpoint_id: "atl-main", lane_type: "precheck", wait_minutes: 10 }),
      makeReading({ checkpoint_id: "atl-south", lane_type: "standard", wait_minutes: 15 }),
    ];
    const fused = fuseReadings(readings);
    expect(fused).toHaveLength(3);
  });
});
