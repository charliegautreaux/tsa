import { describe, it, expect } from "vitest";
import {
  getWaitColor,
  getWaitSeverity,
  WAIT_COLORS,
} from "@/lib/utils/colors";

describe("getWaitColor", () => {
  it("returns green for 0-15 minutes", () => {
    expect(getWaitColor(0)).toBe(WAIT_COLORS.green);
    expect(getWaitColor(10)).toBe(WAIT_COLORS.green);
    expect(getWaitColor(15)).toBe(WAIT_COLORS.green);
  });

  it("returns yellow for 16-30 minutes", () => {
    expect(getWaitColor(16)).toBe(WAIT_COLORS.yellow);
    expect(getWaitColor(25)).toBe(WAIT_COLORS.yellow);
    expect(getWaitColor(30)).toBe(WAIT_COLORS.yellow);
  });

  it("returns orange for 31-60 minutes", () => {
    expect(getWaitColor(31)).toBe(WAIT_COLORS.orange);
    expect(getWaitColor(45)).toBe(WAIT_COLORS.orange);
    expect(getWaitColor(60)).toBe(WAIT_COLORS.orange);
  });

  it("returns red for 60+ minutes", () => {
    expect(getWaitColor(61)).toBe(WAIT_COLORS.red);
    expect(getWaitColor(120)).toBe(WAIT_COLORS.red);
  });

  it("handles null/undefined as green", () => {
    expect(getWaitColor(null as unknown as number)).toBe(WAIT_COLORS.green);
  });
});

describe("getWaitSeverity", () => {
  it("returns correct severity labels", () => {
    expect(getWaitSeverity(5)).toBe("low");
    expect(getWaitSeverity(20)).toBe("moderate");
    expect(getWaitSeverity(45)).toBe("high");
    expect(getWaitSeverity(90)).toBe("severe");
  });
});
