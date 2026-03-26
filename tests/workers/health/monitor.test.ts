import { describe, it, expect } from "vitest";
import { assessFeedHealth, type HealthAssessment } from "@/workers/health/monitor";

describe("assessFeedHealth", () => {
  it("healthy feed stays active", () => {
    const result = assessFeedHealth({ errorCount: 2, successCount: 100, sameValueStreak: 3, lastValue: 25 });
    expect(result.status).toBe("healthy");
    expect(result.action).toBe("none");
  });

  it("flags stale when same value repeated 10x", () => {
    const result = assessFeedHealth({ errorCount: 0, successCount: 50, sameValueStreak: 10, lastValue: 25 });
    expect(result.status).toBe("stale");
    expect(result.action).toBe("flag");
  });

  it("reduces frequency at 30% error rate", () => {
    const result = assessFeedHealth({ errorCount: 35, successCount: 65, sameValueStreak: 0, lastValue: 25 });
    expect(result.status).toBe("degraded");
    expect(result.action).toBe("reduce-frequency");
  });

  it("deactivates at 50% error rate", () => {
    const result = assessFeedHealth({ errorCount: 55, successCount: 45, sameValueStreak: 0, lastValue: 25 });
    expect(result.status).toBe("failing");
    expect(result.action).toBe("deactivate");
  });
});
