import { describe, it, expect } from "vitest";
import { validateReading, createRawReading } from "@/lib/adapters/base";
import { getAdapter } from "@/lib/adapters/registry";

describe("validateReading", () => {
  it("accepts valid reading", () => {
    const reading = createRawReading({
      airport_code: "ATL",
      checkpoint_id: "atl-main",
      lane_type: "standard",
      wait_minutes: 25,
      confidence: 0.9,
      source_type: "sensor",
      measured_at: new Date().toISOString(),
    });
    expect(validateReading(reading)).toBe(true);
  });

  it("rejects negative wait time", () => {
    const reading = createRawReading({
      airport_code: "ATL",
      checkpoint_id: "atl-main",
      lane_type: "standard",
      wait_minutes: -5,
      confidence: 0.9,
      source_type: "sensor",
      measured_at: new Date().toISOString(),
    });
    expect(validateReading(reading)).toBe(false);
  });

  it("rejects wait time over 300 minutes", () => {
    const reading = createRawReading({
      airport_code: "ATL",
      checkpoint_id: "atl-main",
      lane_type: "standard",
      wait_minutes: 350,
      confidence: 0.9,
      source_type: "sensor",
      measured_at: new Date().toISOString(),
    });
    expect(validateReading(reading)).toBe(false);
  });

  it("rejects confidence outside 0-1", () => {
    const reading = createRawReading({
      airport_code: "ATL",
      checkpoint_id: "atl-main",
      lane_type: "standard",
      wait_minutes: 25,
      confidence: 1.5,
      source_type: "sensor",
      measured_at: new Date().toISOString(),
    });
    expect(validateReading(reading)).toBe(false);
  });

  it("rejects missing airport code", () => {
    const reading = createRawReading({
      airport_code: "",
      checkpoint_id: "atl-main",
      lane_type: "standard",
      wait_minutes: 25,
      confidence: 0.9,
      source_type: "sensor",
      measured_at: new Date().toISOString(),
    });
    expect(validateReading(reading)).toBe(false);
  });
});

describe("getAdapter", () => {
  it("returns null for unknown type", () => {
    const adapter = getAdapter("nonexistent" as any);
    expect(adapter).toBeNull();
  });
});
