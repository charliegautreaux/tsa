import { describe, it, expect } from "vitest";
import { shouldRetry, shouldMarkDead, shouldMarkDormant } from "@/workers/health/self-heal";

describe("shouldRetry", () => {
  it("retries inactive feed after 6h", () => {
    const lastError = new Date(Date.now() - 7 * 3600_000).toISOString();
    expect(shouldRetry("inactive", lastError)).toBe(true);
  });

  it("does not retry if less than 6h since last error", () => {
    const lastError = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(shouldRetry("inactive", lastError)).toBe(false);
  });
});

describe("shouldMarkDormant", () => {
  it("marks dormant after 7 days inactive", () => {
    const lastSuccess = new Date(Date.now() - 8 * 24 * 3600_000).toISOString();
    expect(shouldMarkDormant("inactive", lastSuccess)).toBe(true);
  });
});

describe("shouldMarkDead", () => {
  it("marks dead after 30 days", () => {
    const lastSuccess = new Date(Date.now() - 31 * 24 * 3600_000).toISOString();
    expect(shouldMarkDead("dormant", lastSuccess)).toBe(true);
  });
});
