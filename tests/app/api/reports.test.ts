import { describe, it, expect } from "vitest";
import { validateReport } from "@/lib/utils/validation";

describe("report input validation", () => {
  it("accepts valid report", () => {
    const result = validateReport({
      airport_code: "ATL",
      checkpoint: "Main",
      lane_type: "standard",
      wait_minutes: 25,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing airport code", () => {
    const result = validateReport({
      airport_code: "",
      checkpoint: "Main",
      lane_type: "standard",
      wait_minutes: 25,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects wait time out of range", () => {
    const result = validateReport({
      airport_code: "ATL",
      checkpoint: "Main",
      lane_type: "standard",
      wait_minutes: 500,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid lane type", () => {
    const result = validateReport({
      airport_code: "ATL",
      checkpoint: "Main",
      lane_type: "vip",
      wait_minutes: 10,
    });
    expect(result.valid).toBe(false);
  });
});
