import { describe, it, expect } from "vitest";
import { calculateTrend } from "@/lib/utils/trend";

describe("calculateTrend", () => {
  it("returns stable for no readings", () => {
    expect(calculateTrend([])).toBe("stable");
  });
  it("returns stable for single reading", () => {
    expect(calculateTrend([20])).toBe("stable");
  });
  it("returns rising for increasing values", () => {
    expect(calculateTrend([10, 15, 20, 25, 30])).toBe("rising");
  });
  it("returns falling for decreasing values", () => {
    expect(calculateTrend([30, 25, 20, 15, 10])).toBe("falling");
  });
  it("returns stable for flat values", () => {
    expect(calculateTrend([20, 21, 19, 20, 21])).toBe("stable");
  });
  it("returns stable for minor fluctuations within threshold", () => {
    expect(calculateTrend([20, 22, 19, 21, 20])).toBe("stable");
  });
  it("detects rising even with noise", () => {
    expect(calculateTrend([10, 12, 11, 15, 14, 18, 20])).toBe("rising");
  });
  it("detects falling even with noise", () => {
    expect(calculateTrend([30, 28, 29, 25, 26, 22, 20])).toBe("falling");
  });
});
