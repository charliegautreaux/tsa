import { describe, it, expect } from "vitest";
import { getPollingInterval, shouldPollNow } from "@/lib/config/polling.config";

describe("getPollingInterval", () => {
  it("returns 60s for large hubs", () => {
    expect(getPollingInterval("large_hub")).toBe(60);
  });

  it("returns 300s for medium hubs", () => {
    expect(getPollingInterval("medium_hub")).toBe(300);
  });

  it("returns 900s for small hubs", () => {
    expect(getPollingInterval("small_hub")).toBe(900);
  });

  it("returns 1800s for nonhub and unknown", () => {
    expect(getPollingInterval("nonhub")).toBe(1800);
    expect(getPollingInterval("unknown")).toBe(1800);
  });
});

describe("shouldPollNow", () => {
  it("returns true when last poll exceeds interval", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(shouldPollNow("medium_hub", tenMinAgo)).toBe(true);
  });

  it("returns false when last poll is recent", () => {
    const thirtySecAgo = new Date(Date.now() - 30 * 1000).toISOString();
    expect(shouldPollNow("medium_hub", thirtySecAgo)).toBe(false);
  });

  it("returns true when last poll is null (never polled)", () => {
    expect(shouldPollNow("small_hub", null)).toBe(true);
  });

  it("always returns true for large hubs within 60s", () => {
    const fiftySecAgo = new Date(Date.now() - 50 * 1000).toISOString();
    expect(shouldPollNow("large_hub", fiftySecAgo)).toBe(false);
    const ninetySecAgo = new Date(Date.now() - 90 * 1000).toISOString();
    expect(shouldPollNow("large_hub", ninetySecAgo)).toBe(true);
  });
});
