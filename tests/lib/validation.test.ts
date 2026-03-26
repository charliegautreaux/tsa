import { describe, it, expect } from "vitest";
import { validateReport, sanitizeString, isValidIata } from "@/lib/utils/validation";

describe("isValidIata", () => {
  it("accepts 3-letter uppercase codes", () => {
    expect(isValidIata("ATL")).toBe(true);
    expect(isValidIata("LAX")).toBe(true);
  });
  it("accepts lowercase", () => {
    expect(isValidIata("atl")).toBe(true);
  });
  it("rejects invalid codes", () => {
    expect(isValidIata("")).toBe(false);
    expect(isValidIata("AB")).toBe(false);
    expect(isValidIata("ABCD")).toBe(false);
    expect(isValidIata("12A")).toBe(false);
  });
});

describe("sanitizeString", () => {
  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });
  it("strips HTML tags", () => {
    expect(sanitizeString("hello <script>alert(1)</script>")).toBe("hello alert(1)");
  });
  it("truncates to max length", () => {
    expect(sanitizeString("a".repeat(300), 200).length).toBe(200);
  });
  it("handles null/undefined", () => {
    expect(sanitizeString(null as unknown as string)).toBe("");
    expect(sanitizeString(undefined as unknown as string)).toBe("");
  });
});

describe("validateReport", () => {
  it("accepts valid report", () => {
    const result = validateReport({ airport_code: "ATL", checkpoint: "Main", lane_type: "standard", wait_minutes: 25 });
    expect(result.valid).toBe(true);
  });
  it("rejects missing airport", () => {
    const result = validateReport({ airport_code: "", checkpoint: "Main", lane_type: "standard", wait_minutes: 25 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("airport");
  });
  it("rejects negative wait time", () => {
    const result = validateReport({ airport_code: "ATL", checkpoint: "Main", lane_type: "standard", wait_minutes: -5 });
    expect(result.valid).toBe(false);
  });
  it("rejects excessive wait time", () => {
    const result = validateReport({ airport_code: "ATL", checkpoint: "Main", lane_type: "standard", wait_minutes: 400 });
    expect(result.valid).toBe(false);
  });
});
