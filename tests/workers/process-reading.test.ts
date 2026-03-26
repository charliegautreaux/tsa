import { describe, it, expect, vi } from "vitest";
import { processReadings } from "@/workers/ingestion/process-reading";
import type { RawReading } from "@/lib/adapters/base";

function makeReading(overrides: Partial<RawReading> = {}): RawReading {
  return {
    airport_code: "ATL",
    checkpoint_id: "atl-main",
    lane_type: "standard",
    wait_minutes: 25,
    confidence: 0.9,
    source_type: "sensor",
    measured_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("processReadings", () => {
  it("validates, fuses, and returns processed results", async () => {
    const readings = [
      makeReading({ wait_minutes: 25 }),
      makeReading({ wait_minutes: 30, lane_type: "precheck" }),
    ];

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          all: vi.fn().mockResolvedValue({ results: [{ wait_minutes: 20 }, { wait_minutes: 22 }] }),
        }),
      }),
      batch: vi.fn().mockResolvedValue([]),
    };

    const mockKv = {
      put: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processReadings(readings, mockDb as unknown as D1Database, mockKv as unknown as KVNamespace);
    expect(result.processed).toBe(2);
    expect(result.rejected).toBe(0);
  });

  it("rejects invalid readings", async () => {
    const readings = [
      makeReading({ wait_minutes: -5 }),
      makeReading({ wait_minutes: 25 }),
    ];

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
      batch: vi.fn().mockResolvedValue([]),
    };

    const mockKv = {
      put: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processReadings(readings, mockDb as unknown as D1Database, mockKv as unknown as KVNamespace);
    expect(result.processed).toBe(1);
    expect(result.rejected).toBe(1);
  });
});
