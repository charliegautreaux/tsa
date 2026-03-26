import { describe, it, expect } from "vitest";
import { formatRelativeTime, formatMinutes, isStale } from "@/lib/utils/time";

describe("formatRelativeTime", () => {
  it("returns 'just now' for <30 seconds ago", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns '1 min ago' for 60 seconds ago", () => {
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    expect(formatRelativeTime(oneMinAgo)).toBe("1 min ago");
  });

  it("returns '5 min ago' for 5 minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 300_000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 min ago");
  });

  it("returns '1 hr ago' for 60 minutes ago", () => {
    const oneHrAgo = new Date(Date.now() - 3_600_000).toISOString();
    expect(formatRelativeTime(oneHrAgo)).toBe("1 hr ago");
  });
});

describe("formatMinutes", () => {
  it("formats minutes with unit", () => {
    expect(formatMinutes(5)).toBe("5 min");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(0)).toBe("<1 min");
  });
});

describe("isStale", () => {
  it("returns false for recent timestamps", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(isStale(recent, 600)).toBe(false);
  });

  it("returns true for old timestamps", () => {
    const old = new Date(Date.now() - 900_000).toISOString();
    expect(isStale(old, 600)).toBe(true);
  });
});
