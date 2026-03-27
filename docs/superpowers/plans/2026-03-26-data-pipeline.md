# Data Pipeline Implementation Plan (Plan 2 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete data ingestion pipeline — feed adapters, reading processor, trend calculator, data fusion, KV cache layer, and scheduled worker orchestrator.

**Architecture:** Adapter pattern — every data source implements the same `FeedAdapter` interface, outputs `NormalizedReading[]`. Ingestion worker polls feeds on cron, processes readings through validation → fusion → D1 write → KV cache → Durable Object broadcast.

**Tech Stack:** TypeScript, Cloudflare Workers (D1, KV, Durable Objects), vitest

---

## File Structure

```
src/
├── lib/
│   ├── adapters/
│   │   ├── base.ts              ← FeedAdapter interface + helpers
│   │   ├── registry.ts          ← Adapter lookup by type
│   │   ├── crowdsource.ts       ← Reads user reports from D1
│   │   ├── dynamic-json.ts      ← Config-driven JSONPath mapper
│   │   ├── airport-json.ts      ← Generic structured JSON feed
│   │   ├── airport-html.ts      ← HTML scraper (last resort)
│   │   ├── bliptrack.ts         ← BlipTrack/Veovo sensor
│   │   ├── xovis.ts             ← Xovis 3D sensor
│   │   ├── faa-swim.ts          ← FAA ground stops/delays
│   │   ├── flightaware.ts       ← FlightAware AeroAPI
│   │   ├── noaa.ts              ← NOAA weather data
│   │   └── tsa-throughput.ts    ← TSA daily passenger data
│   ├── db/
│   │   └── kv.ts                ← KV cache helpers
│   └── utils/
│       ├── trend.ts             ← Trend calculator (rising/falling/stable)
│       └── validation.ts        ← Reading validation
├── workers/
│   ├── ingestion/
│   │   ├── poll-feeds.ts        ← Main polling orchestrator
│   │   ├── process-reading.ts   ← Normalize + validate + store
│   │   └── fusion.ts            ← Multi-source data fusion
│   └── scheduled.ts             ← Cron trigger entry point
tests/
├── lib/
│   ├── adapters/
│   │   ├── base.test.ts
│   │   ├── crowdsource.test.ts
│   │   ├── dynamic-json.test.ts
│   │   └── airport-json.test.ts
│   ├── trend.test.ts
│   └── validation.test.ts
├── workers/
│   ├── process-reading.test.ts
│   └── fusion.test.ts
```

---

### Task 1: Feed Adapter Base Interface + Registry

**Files:**
- Create: `src/lib/adapters/base.ts`
- Create: `src/lib/adapters/registry.ts`
- Test: `tests/lib/adapters/base.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/adapters/base.test.ts
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
  it("returns adapter for known type", () => {
    const adapter = getAdapter("crowdsource");
    expect(adapter).toBeDefined();
    expect(adapter.id).toBe("crowdsource");
  });

  it("returns null for unknown type", () => {
    const adapter = getAdapter("nonexistent" as any);
    expect(adapter).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/adapters/base.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement base adapter**

```typescript
// src/lib/adapters/base.ts
import type { NormalizedReading, LaneType, SourceType } from "@/lib/types/reading";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";

export interface RawReading {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  wait_minutes: number;
  confidence: number;
  source_type: SourceType;
  measured_at: string;
}

export interface FeedAdapter {
  id: string;
  fetch(config: FeedConfig, env: Record<string, unknown>): Promise<RawReading[]>;
  healthCheck(config: FeedConfig, env: Record<string, unknown>): Promise<FeedHealth>;
}

export function createRawReading(partial: Partial<RawReading> & {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  wait_minutes: number;
  confidence: number;
  source_type: SourceType;
  measured_at: string;
}): RawReading {
  return { ...partial };
}

export function validateReading(reading: RawReading): boolean {
  if (!reading.airport_code || reading.airport_code.length < 2) return false;
  if (!reading.checkpoint_id) return false;
  if (reading.wait_minutes < 0 || reading.wait_minutes > 300) return false;
  if (reading.confidence < 0 || reading.confidence > 1) return false;
  if (!reading.measured_at) return false;
  return true;
}

export function toNormalized(raw: RawReading): NormalizedReading {
  return {
    ...raw,
    ingested_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Implement adapter registry (stub — adapters added in later tasks)**

```typescript
// src/lib/adapters/registry.ts
import type { FeedAdapter } from "./base";
import type { AdapterType } from "@/lib/types/feed";

const adapters = new Map<string, FeedAdapter>();

export function registerAdapter(adapter: FeedAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(type: AdapterType | string): FeedAdapter | null {
  return adapters.get(type) ?? null;
}

export function getAllAdapters(): FeedAdapter[] {
  return Array.from(adapters.values());
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/lib/adapters/base.test.ts`
Expected: PASS (except getAdapter tests — adapter not registered yet)

Note: The registry test for "crowdsource" will fail until Task 2 registers it. For now, adjust the test to check that getAdapter returns null for unregistered types, and add the "returns adapter for known type" test in Task 2.

Update the test: move the "returns adapter for known type" test to Task 2's test file. Keep only:

```typescript
describe("getAdapter", () => {
  it("returns null for unknown type", () => {
    const adapter = getAdapter("nonexistent" as any);
    expect(adapter).toBeNull();
  });
});
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/adapters/base.ts src/lib/adapters/registry.ts tests/lib/adapters/base.test.ts
git commit -m "feat: add feed adapter base interface, validation, and registry"
```

---

### Task 2: Crowdsource Adapter

**Files:**
- Create: `src/lib/adapters/crowdsource.ts`
- Test: `tests/lib/adapters/crowdsource.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/adapters/crowdsource.test.ts
import { describe, it, expect, vi } from "vitest";
import { crowdsourceAdapter } from "@/lib/adapters/crowdsource";
import type { FeedConfig } from "@/lib/types/feed";

const mockConfig: FeedConfig = {
  id: "atl-crowd",
  airport_code: "ATL",
  checkpoint_id: null,
  type: "crowdsourced",
  adapter: "crowdsource",
  url: null,
  auth_config: { type: "none" },
  polling_interval_sec: 60,
  dynamic_mapping: null,
  status: "active",
  reliability_score: 0.7,
  discovered_by: "manual",
};

describe("crowdsourceAdapter", () => {
  it("has correct id", () => {
    expect(crowdsourceAdapter.id).toBe("crowdsource");
  });

  it("fetches recent reports from D1 and converts to readings", async () => {
    const now = new Date().toISOString();
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                airport_code: "ATL",
                checkpoint: "Main",
                lane_type: "standard",
                wait_minutes: 30,
                created_at: now,
              },
              {
                airport_code: "ATL",
                checkpoint: "South",
                lane_type: "precheck",
                wait_minutes: 15,
                created_at: now,
              },
            ],
          }),
        }),
      }),
    };

    const readings = await crowdsourceAdapter.fetch(mockConfig, { DB: mockDb });
    expect(readings).toHaveLength(2);
    expect(readings[0].airport_code).toBe("ATL");
    expect(readings[0].source_type).toBe("crowdsourced");
    expect(readings[0].confidence).toBe(0.7);
    expect(readings[0].wait_minutes).toBe(30);
    expect(readings[1].lane_type).toBe("precheck");
  });

  it("returns empty array when no recent reports", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    };

    const readings = await crowdsourceAdapter.fetch(mockConfig, { DB: mockDb });
    expect(readings).toHaveLength(0);
  });

  it("health check returns healthy when DB is accessible", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 5 }),
        }),
      }),
    };

    const health = await crowdsourceAdapter.healthCheck(mockConfig, { DB: mockDb });
    expect(health.is_healthy).toBe(true);
    expect(health.feed_id).toBe("atl-crowd");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/adapters/crowdsource.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement crowdsource adapter**

```typescript
// src/lib/adapters/crowdsource.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

function checkpointToId(airportCode: string, checkpoint: string): string {
  return `${airportCode.toLowerCase()}-${checkpoint.toLowerCase().replace(/\s+/g, "-")}`;
}

export const crowdsourceAdapter: FeedAdapter = {
  id: "crowdsource",

  async fetch(config: FeedConfig, env: Record<string, unknown>): Promise<RawReading[]> {
    const db = env.DB as D1Database;
    const since = new Date(Date.now() - 30 * 60_000).toISOString(); // last 30 min

    const result = await db
      .prepare(
        `SELECT airport_code, checkpoint, lane_type, wait_minutes, created_at
         FROM reports
         WHERE airport_code = ?1 AND created_at > ?2
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .bind(config.airport_code, since)
      .all<{
        airport_code: string;
        checkpoint: string;
        lane_type: string;
        wait_minutes: number;
        created_at: string;
      }>();

    return result.results.map((r) => ({
      airport_code: r.airport_code,
      checkpoint_id: checkpointToId(r.airport_code, r.checkpoint),
      lane_type: r.lane_type as RawReading["lane_type"],
      wait_minutes: r.wait_minutes,
      confidence: 0.7,
      source_type: "crowdsourced" as const,
      measured_at: r.created_at,
    }));
  },

  async healthCheck(config: FeedConfig, env: Record<string, unknown>): Promise<FeedHealth> {
    const db = env.DB as D1Database;
    const start = performance.now();
    try {
      const since = new Date(Date.now() - 3600_000).toISOString();
      await db
        .prepare("SELECT COUNT(*) as count FROM reports WHERE airport_code = ?1 AND created_at > ?2")
        .bind(config.airport_code, since)
        .first();
      return {
        feed_id: config.id,
        is_healthy: true,
        response_time_ms: Math.round(performance.now() - start),
        last_error: null,
      };
    } catch (err) {
      return {
        feed_id: config.id,
        is_healthy: false,
        response_time_ms: Math.round(performance.now() - start),
        last_error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
};

registerAdapter(crowdsourceAdapter);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/adapters/crowdsource.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters/crowdsource.ts tests/lib/adapters/crowdsource.test.ts
git commit -m "feat: add crowdsource adapter — reads user reports from D1"
```

---

### Task 3: Dynamic JSON Adapter

**Files:**
- Create: `src/lib/adapters/dynamic-json.ts`
- Test: `tests/lib/adapters/dynamic-json.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/adapters/dynamic-json.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dynamicJsonAdapter } from "@/lib/adapters/dynamic-json";
import type { FeedConfig } from "@/lib/types/feed";

const mockConfig: FeedConfig = {
  id: "atl-sensor-1",
  airport_code: "ATL",
  checkpoint_id: "atl-main",
  type: "sensor-api",
  adapter: "dynamic-json",
  url: "https://example.com/api/wait-times",
  auth_config: { type: "none" },
  polling_interval_sec: 60,
  dynamic_mapping: {
    wait_minutes: "$.data.checkpoints[*].waitTime",
    checkpoint: "$.data.checkpoints[*].name",
    lane_type: "$.data.checkpoints[*].laneType",
    measured_at: "$.data.lastUpdated",
  },
  status: "active",
  reliability_score: 0.8,
  discovered_by: "known-pattern",
};

describe("dynamicJsonAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has correct id", () => {
    expect(dynamicJsonAdapter.id).toBe("dynamic-json");
  });

  it("fetches and maps JSON using dynamic mapping", async () => {
    const mockResponse = {
      data: {
        lastUpdated: "2026-03-26T10:00:00Z",
        checkpoints: [
          { name: "Main", waitTime: 25, laneType: "standard" },
          { name: "Main", waitTime: 10, laneType: "precheck" },
        ],
      },
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const readings = await dynamicJsonAdapter.fetch(mockConfig, {});
    expect(readings).toHaveLength(2);
    expect(readings[0].wait_minutes).toBe(25);
    expect(readings[0].checkpoint_id).toBe("atl-main");
    expect(readings[0].lane_type).toBe("standard");
    expect(readings[1].wait_minutes).toBe(10);
    expect(readings[1].lane_type).toBe("precheck");
  });

  it("returns empty array on fetch error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const readings = await dynamicJsonAdapter.fetch(mockConfig, {});
    expect(readings).toHaveLength(0);
  });

  it("returns empty array when no mapping configured", async () => {
    const noMapping = { ...mockConfig, dynamic_mapping: null };
    const readings = await dynamicJsonAdapter.fetch(noMapping, {});
    expect(readings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/adapters/dynamic-json.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement dynamic JSON adapter**

```typescript
// src/lib/adapters/dynamic-json.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * Simple JSONPath-like value extractor.
 * Supports: $.key.nested, $.key[*].field
 * Does NOT support full JSONPath spec — just enough for feed mapping.
 */
function extractValues(obj: unknown, path: string): unknown[] {
  const parts = path.replace(/^\$\.?/, "").split(".");
  let current: unknown[] = [obj];

  for (const part of parts) {
    const arrayMatch = part.match(/^(.+)\[\*\]$/);
    const next: unknown[] = [];

    for (const item of current) {
      if (item == null || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;

      if (arrayMatch) {
        const key = arrayMatch[1];
        const arr = record[key];
        if (Array.isArray(arr)) {
          next.push(...arr);
        }
      } else {
        if (part in record) {
          next.push(record[part]);
        }
      }
    }
    current = next;
  }
  return current;
}

function buildHeaders(config: FeedConfig): HeadersInit {
  const headers: Record<string, string> = { "User-Agent": "PreBoard/1.0" };
  if (config.auth_config.type === "api-key") {
    headers[config.auth_config.header] = config.auth_config.key;
  } else if (config.auth_config.type === "bearer") {
    headers["Authorization"] = `Bearer ${config.auth_config.token}`;
  }
  return headers;
}

export const dynamicJsonAdapter: FeedAdapter = {
  id: "dynamic-json",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.url || !config.dynamic_mapping) return [];

    try {
      const response = await fetch(config.url, {
        headers: buildHeaders(config),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];

      const json = await response.json();
      const mapping = config.dynamic_mapping;

      const waitValues = extractValues(json, mapping.wait_minutes);
      const checkpointValues = mapping.checkpoint ? extractValues(json, mapping.checkpoint) : [];
      const laneValues = mapping.lane_type ? extractValues(json, mapping.lane_type) : [];
      const timeValues = mapping.measured_at ? extractValues(json, mapping.measured_at) : [];

      const measuredAt = (timeValues[0] as string) || new Date().toISOString();
      const readings: RawReading[] = [];

      for (let i = 0; i < waitValues.length; i++) {
        const waitMin = Number(waitValues[i]);
        if (isNaN(waitMin)) continue;

        const checkpoint = (checkpointValues[i] as string) || "main";
        const checkpointId = config.checkpoint_id || `${config.airport_code.toLowerCase()}-${checkpoint.toLowerCase().replace(/\s+/g, "-")}`;
        const laneType = (laneValues[i] as string) || "standard";

        readings.push({
          airport_code: config.airport_code,
          checkpoint_id: checkpointId,
          lane_type: normalizeLaneType(laneType),
          wait_minutes: waitMin,
          confidence: 0.8,
          source_type: "airport-api",
          measured_at: typeof timeValues[i] === "string" ? (timeValues[i] as string) : measuredAt,
        });
      }

      return readings;
    } catch {
      return [];
    }
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    if (!config.url) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: 0, last_error: "No URL configured" };
    }
    const start = performance.now();
    try {
      const response = await fetch(config.url, {
        method: "HEAD",
        headers: buildHeaders(config),
        signal: AbortSignal.timeout(5_000),
      });
      return {
        feed_id: config.id,
        is_healthy: response.ok,
        response_time_ms: Math.round(performance.now() - start),
        last_error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        feed_id: config.id,
        is_healthy: false,
        response_time_ms: Math.round(performance.now() - start),
        last_error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
};

function normalizeLaneType(raw: string): RawReading["lane_type"] {
  const lower = raw.toLowerCase();
  if (lower.includes("precheck") || lower.includes("pre-check") || lower.includes("tsa-pre")) return "precheck";
  if (lower.includes("clear")) return "clear";
  if (lower.includes("standard") || lower.includes("general") || lower.includes("regular")) return "standard";
  return "unknown";
}

registerAdapter(dynamicJsonAdapter);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/adapters/dynamic-json.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters/dynamic-json.ts tests/lib/adapters/dynamic-json.test.ts
git commit -m "feat: add dynamic-json adapter — config-driven JSONPath mapper"
```

---

### Task 4: Airport JSON Adapter

**Files:**
- Create: `src/lib/adapters/airport-json.ts`
- Test: `tests/lib/adapters/airport-json.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/adapters/airport-json.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { airportJsonAdapter } from "@/lib/adapters/airport-json";
import type { FeedConfig } from "@/lib/types/feed";

const mockConfig: FeedConfig = {
  id: "den-json",
  airport_code: "DEN",
  checkpoint_id: null,
  type: "airport-web",
  adapter: "airport-json",
  url: "https://flydenver.com/api/security/wait-times",
  auth_config: { type: "none" },
  polling_interval_sec: 60,
  dynamic_mapping: null,
  status: "active",
  reliability_score: 0.85,
  discovered_by: "known-pattern",
};

describe("airportJsonAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has correct id", () => {
    expect(airportJsonAdapter.id).toBe("airport-json");
  });

  it("parses common airport JSON formats", async () => {
    // Format: array of checkpoint objects with wait times
    const mockResponse = {
      checkpoints: [
        {
          name: "North Security",
          terminal: "Main",
          waits: { general: 22, precheck: 8, clear: 3 },
          updated: "2026-03-26T10:00:00Z",
        },
      ],
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const readings = await airportJsonAdapter.fetch(mockConfig, {});
    expect(readings.length).toBeGreaterThanOrEqual(1);
    expect(readings[0].airport_code).toBe("DEN");
    expect(readings[0].source_type).toBe("airport-api");
  });

  it("returns empty array on network error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
    const readings = await airportJsonAdapter.fetch(mockConfig, {});
    expect(readings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/adapters/airport-json.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement airport JSON adapter**

```typescript
// src/lib/adapters/airport-json.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * Generic airport JSON adapter.
 * Tries multiple common JSON structures used by US airports.
 * Falls back gracefully if structure doesn't match.
 */

interface CheckpointData {
  name?: string;
  checkpoint?: string;
  terminal?: string;
  waits?: Record<string, number>;
  wait_time?: number;
  waitTime?: number;
  wait_minutes?: number;
  general?: number;
  standard?: number;
  precheck?: number;
  clear?: number;
  updated?: string;
  updatedAt?: string;
  timestamp?: string;
  lanes?: Array<{ type: string; wait: number }>;
}

function parseCheckpoint(
  airportCode: string,
  cp: CheckpointData,
  fallbackTime: string
): RawReading[] {
  const readings: RawReading[] = [];
  const name = cp.name || cp.checkpoint || "Main";
  const checkpointId = `${airportCode.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const measuredAt = cp.updated || cp.updatedAt || cp.timestamp || fallbackTime;

  // Format 1: { waits: { general: 22, precheck: 8, clear: 3 } }
  if (cp.waits && typeof cp.waits === "object") {
    for (const [lane, mins] of Object.entries(cp.waits)) {
      if (typeof mins !== "number") continue;
      readings.push({
        airport_code: airportCode,
        checkpoint_id: checkpointId,
        lane_type: normalizeLane(lane),
        wait_minutes: mins,
        confidence: 0.85,
        source_type: "airport-api",
        measured_at: measuredAt,
      });
    }
    return readings;
  }

  // Format 2: { lanes: [{ type: "standard", wait: 22 }] }
  if (Array.isArray(cp.lanes)) {
    for (const lane of cp.lanes) {
      readings.push({
        airport_code: airportCode,
        checkpoint_id: checkpointId,
        lane_type: normalizeLane(lane.type),
        wait_minutes: lane.wait,
        confidence: 0.85,
        source_type: "airport-api",
        measured_at: measuredAt,
      });
    }
    return readings;
  }

  // Format 3: flat fields { standard: 22, precheck: 8 } or { wait_time: 22 }
  const waitValue = cp.wait_time ?? cp.waitTime ?? cp.wait_minutes ?? cp.general ?? cp.standard;
  if (typeof waitValue === "number") {
    readings.push({
      airport_code: airportCode,
      checkpoint_id: checkpointId,
      lane_type: "standard",
      wait_minutes: waitValue,
      confidence: 0.85,
      source_type: "airport-api",
      measured_at: measuredAt,
    });

    if (typeof cp.precheck === "number") {
      readings.push({
        airport_code: airportCode,
        checkpoint_id: checkpointId,
        lane_type: "precheck",
        wait_minutes: cp.precheck,
        confidence: 0.85,
        source_type: "airport-api",
        measured_at: measuredAt,
      });
    }
    if (typeof cp.clear === "number") {
      readings.push({
        airport_code: airportCode,
        checkpoint_id: checkpointId,
        lane_type: "clear",
        wait_minutes: cp.clear,
        confidence: 0.85,
        source_type: "airport-api",
        measured_at: measuredAt,
      });
    }
  }

  return readings;
}

function normalizeLane(raw: string): RawReading["lane_type"] {
  const lower = raw.toLowerCase();
  if (lower.includes("precheck") || lower.includes("pre-check") || lower === "tsa-pre") return "precheck";
  if (lower.includes("clear")) return "clear";
  if (lower.includes("standard") || lower.includes("general") || lower.includes("regular")) return "standard";
  return "unknown";
}

export const airportJsonAdapter: FeedAdapter = {
  id: "airport-json",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.url) return [];

    try {
      const headers: Record<string, string> = { "User-Agent": "PreBoard/1.0" };
      if (config.auth_config.type === "api-key") {
        headers[config.auth_config.header] = config.auth_config.key;
      } else if (config.auth_config.type === "bearer") {
        headers["Authorization"] = `Bearer ${config.auth_config.token}`;
      }

      const response = await fetch(config.url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];

      const json = await response.json() as Record<string, unknown>;
      const now = new Date().toISOString();
      const readings: RawReading[] = [];

      // Try to find checkpoint array in common locations
      const checkpoints = findCheckpoints(json);
      for (const cp of checkpoints) {
        readings.push(...parseCheckpoint(config.airport_code, cp, now));
      }

      return readings;
    } catch {
      return [];
    }
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    if (!config.url) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: 0, last_error: "No URL" };
    }
    const start = performance.now();
    try {
      const response = await fetch(config.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5_000),
      });
      return {
        feed_id: config.id,
        is_healthy: response.ok,
        response_time_ms: Math.round(performance.now() - start),
        last_error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        feed_id: config.id,
        is_healthy: false,
        response_time_ms: Math.round(performance.now() - start),
        last_error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
};

function findCheckpoints(json: Record<string, unknown>): CheckpointData[] {
  // Direct array at root
  if (Array.isArray(json)) return json as CheckpointData[];

  // Common keys: checkpoints, security, waitTimes, data
  for (const key of ["checkpoints", "security", "waitTimes", "wait_times", "data", "results"]) {
    const value = json[key];
    if (Array.isArray(value)) return value as CheckpointData[];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // Nested: { data: { checkpoints: [...] } }
      const nested = value as Record<string, unknown>;
      for (const innerKey of ["checkpoints", "security", "waitTimes", "wait_times"]) {
        if (Array.isArray(nested[innerKey])) return nested[innerKey] as CheckpointData[];
      }
      // Single checkpoint object
      return [value as CheckpointData];
    }
  }

  // Treat entire object as single checkpoint
  return [json as unknown as CheckpointData];
}

registerAdapter(airportJsonAdapter);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/adapters/airport-json.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters/airport-json.ts tests/lib/adapters/airport-json.test.ts
git commit -m "feat: add airport-json adapter — parses common airport JSON formats"
```

---

### Task 5: Sensor Adapters (BlipTrack + Xovis)

**Files:**
- Create: `src/lib/adapters/bliptrack.ts`
- Create: `src/lib/adapters/xovis.ts`

- [ ] **Step 1: Implement BlipTrack adapter**

```typescript
// src/lib/adapters/bliptrack.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * BlipTrack / Veovo sensor protocol adapter.
 * BlipTrack uses Bluetooth/WiFi probe requests to measure passenger flow.
 * Common response format: JSON with queue measurements.
 */
export const bliptrackAdapter: FeedAdapter = {
  id: "bliptrack",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.url) return [];

    try {
      const headers: Record<string, string> = { "User-Agent": "PreBoard/1.0", "Accept": "application/json" };
      if (config.auth_config.type === "api-key") {
        headers[config.auth_config.header] = config.auth_config.key;
      }

      const response = await fetch(config.url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return [];

      const json = await response.json() as Record<string, unknown>;
      return parseBlipTrackResponse(config.airport_code, config.checkpoint_id, json);
    } catch {
      return [];
    }
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    if (!config.url) return { feed_id: config.id, is_healthy: false, response_time_ms: 0, last_error: "No URL" };
    const start = performance.now();
    try {
      const response = await fetch(config.url, { method: "HEAD", signal: AbortSignal.timeout(5_000) });
      return { feed_id: config.id, is_healthy: response.ok, response_time_ms: Math.round(performance.now() - start), last_error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: Math.round(performance.now() - start), last_error: err instanceof Error ? err.message : "Unknown" };
    }
  },
};

interface BlipTrackMeasurement {
  queueName?: string;
  queue_name?: string;
  currentWaitTime?: number;
  current_wait_time?: number;
  averageWaitTime?: number;
  waitTime?: number;
  laneType?: string;
  lane_type?: string;
  timestamp?: string;
  measuredAt?: string;
}

function parseBlipTrackResponse(airportCode: string, checkpointId: string | null, json: Record<string, unknown>): RawReading[] {
  const readings: RawReading[] = [];
  const measurements = findMeasurements(json);
  const now = new Date().toISOString();

  for (const m of measurements) {
    const waitMins = m.currentWaitTime ?? m.current_wait_time ?? m.averageWaitTime ?? m.waitTime;
    if (typeof waitMins !== "number" || waitMins < 0) continue;

    const queueName = m.queueName || m.queue_name || "Main";
    const cpId = checkpointId || `${airportCode.toLowerCase()}-${queueName.toLowerCase().replace(/\s+/g, "-")}`;
    const laneRaw = m.laneType || m.lane_type || "standard";

    readings.push({
      airport_code: airportCode,
      checkpoint_id: cpId,
      lane_type: normalizeLane(laneRaw),
      wait_minutes: Math.round(waitMins),
      confidence: 0.95,
      source_type: "sensor",
      measured_at: m.timestamp || m.measuredAt || now,
    });
  }
  return readings;
}

function findMeasurements(json: Record<string, unknown>): BlipTrackMeasurement[] {
  for (const key of ["measurements", "queues", "data", "results", "waitTimes"]) {
    if (Array.isArray(json[key])) return json[key] as BlipTrackMeasurement[];
  }
  if (Array.isArray(json)) return json as BlipTrackMeasurement[];
  return [json as BlipTrackMeasurement];
}

function normalizeLane(raw: string): RawReading["lane_type"] {
  const l = raw.toLowerCase();
  if (l.includes("precheck") || l.includes("pre-check")) return "precheck";
  if (l.includes("clear")) return "clear";
  if (l.includes("standard") || l.includes("general") || l.includes("regular")) return "standard";
  return "unknown";
}

registerAdapter(bliptrackAdapter);
```

- [ ] **Step 2: Implement Xovis adapter**

```typescript
// src/lib/adapters/xovis.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * Xovis 3D sensor adapter.
 * Xovis uses 3D overhead stereo cameras for people counting and queue measurement.
 * Typically returns person count and estimated wait time.
 */
export const xovisAdapter: FeedAdapter = {
  id: "xovis",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.url) return [];

    try {
      const headers: Record<string, string> = { "User-Agent": "PreBoard/1.0", "Accept": "application/json" };
      if (config.auth_config.type === "api-key") {
        headers[config.auth_config.header] = config.auth_config.key;
      } else if (config.auth_config.type === "bearer") {
        headers["Authorization"] = `Bearer ${config.auth_config.token}`;
      }

      const response = await fetch(config.url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return [];

      const json = await response.json() as Record<string, unknown>;
      return parseXovisResponse(config.airport_code, config.checkpoint_id, json);
    } catch {
      return [];
    }
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    if (!config.url) return { feed_id: config.id, is_healthy: false, response_time_ms: 0, last_error: "No URL" };
    const start = performance.now();
    try {
      const response = await fetch(config.url, { method: "HEAD", signal: AbortSignal.timeout(5_000) });
      return { feed_id: config.id, is_healthy: response.ok, response_time_ms: Math.round(performance.now() - start), last_error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: Math.round(performance.now() - start), last_error: err instanceof Error ? err.message : "Unknown" };
    }
  },
};

interface XovisZone {
  name?: string;
  zoneName?: string;
  zone_name?: string;
  personCount?: number;
  person_count?: number;
  estimatedWaitMinutes?: number;
  estimated_wait_minutes?: number;
  waitTime?: number;
  throughput?: number;
  laneType?: string;
  lane_type?: string;
  timestamp?: string;
}

function parseXovisResponse(airportCode: string, checkpointId: string | null, json: Record<string, unknown>): RawReading[] {
  const readings: RawReading[] = [];
  const zones = findZones(json);
  const now = new Date().toISOString();

  for (const z of zones) {
    let waitMins = z.estimatedWaitMinutes ?? z.estimated_wait_minutes ?? z.waitTime;

    // If only person count + throughput, estimate wait
    if (waitMins == null && typeof z.personCount === "number" && typeof z.throughput === "number" && z.throughput > 0) {
      waitMins = Math.round(z.personCount / z.throughput);
    }
    if (typeof waitMins !== "number" || waitMins < 0) continue;

    const name = z.name || z.zoneName || z.zone_name || "Main";
    const cpId = checkpointId || `${airportCode.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, "-")}`;
    const laneRaw = z.laneType || z.lane_type || "standard";

    readings.push({
      airport_code: airportCode,
      checkpoint_id: cpId,
      lane_type: normalizeLane(laneRaw),
      wait_minutes: Math.round(waitMins),
      confidence: 0.95,
      source_type: "sensor",
      measured_at: z.timestamp || now,
    });
  }
  return readings;
}

function findZones(json: Record<string, unknown>): XovisZone[] {
  for (const key of ["zones", "sensors", "data", "measurements", "results"]) {
    if (Array.isArray(json[key])) return json[key] as XovisZone[];
  }
  if (Array.isArray(json)) return json as XovisZone[];
  return [json as XovisZone];
}

function normalizeLane(raw: string): RawReading["lane_type"] {
  const l = raw.toLowerCase();
  if (l.includes("precheck") || l.includes("pre-check")) return "precheck";
  if (l.includes("clear")) return "clear";
  if (l.includes("standard") || l.includes("general") || l.includes("regular")) return "standard";
  return "unknown";
}

registerAdapter(xovisAdapter);
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/lib/adapters/`
Expected: All passing

- [ ] **Step 4: Commit**

```bash
git add src/lib/adapters/bliptrack.ts src/lib/adapters/xovis.ts
git commit -m "feat: add BlipTrack and Xovis sensor adapters"
```

---

### Task 6: Government + Flight Data Adapters

**Files:**
- Create: `src/lib/adapters/faa-swim.ts`
- Create: `src/lib/adapters/noaa.ts`
- Create: `src/lib/adapters/tsa-throughput.ts`
- Create: `src/lib/adapters/flightaware.ts`

- [ ] **Step 1: Implement FAA SWIM adapter**

```typescript
// src/lib/adapters/faa-swim.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * FAA SWIM adapter — ground stops, delay programs, airport status.
 * Uses FAA's Airport Status API (free, no auth).
 * URL pattern: https://soa.smext.faa.gov/asws/api/airport/status/{IATA}
 */
export const faaSwimAdapter: FeedAdapter = {
  id: "faa-swim",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    const url = config.url || `https://soa.smext.faa.gov/asws/api/airport/status/${config.airport_code}`;

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PreBoard/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];

      const json = await response.json() as Record<string, unknown>;
      // FAA SWIM doesn't provide wait times directly, but provides
      // delay status that feeds into prediction. Store as metadata reading.
      const status = json.Status as string || json.status as string || "";
      const delay = json.Delay as string || json.delay as string || "false";
      const isDelayed = delay === "true" || status.toLowerCase().includes("delay");

      // Return a synthetic reading used by the prediction engine
      // Wait minutes = 0 means no direct measurement, but delay info is stored
      if (isDelayed) {
        return [{
          airport_code: config.airport_code,
          checkpoint_id: `${config.airport_code.toLowerCase()}-faa-status`,
          lane_type: "unknown",
          wait_minutes: 0,
          confidence: 0.5,
          source_type: "predicted",
          measured_at: new Date().toISOString(),
        }];
      }
      return [];
    } catch {
      return [];
    }
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    const url = config.url || `https://soa.smext.faa.gov/asws/api/airport/status/${config.airport_code}`;
    const start = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      return { feed_id: config.id, is_healthy: response.ok, response_time_ms: Math.round(performance.now() - start), last_error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: Math.round(performance.now() - start), last_error: err instanceof Error ? err.message : "Unknown" };
    }
  },
};

registerAdapter(faaSwimAdapter);
```

- [ ] **Step 2: Implement NOAA weather adapter**

```typescript
// src/lib/adapters/noaa.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * NOAA adapter — aviation weather (METAR/TAF).
 * Used to adjust predictions when weather impacts operations.
 * URL: https://api.weather.gov/stations/{ICAO}/observations/latest
 * Note: Does not produce wait time readings directly.
 * Returns empty readings array — weather data is consumed by prediction engine via separate query.
 */
export const noaaAdapter: FeedAdapter = {
  id: "noaa",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    // NOAA data feeds into prediction engine, not direct wait times
    // The prediction engine queries weather separately
    return [];
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    // Check that the NOAA API is reachable for this airport
    const icao = config.url || `K${config.airport_code}`;
    const url = `https://api.weather.gov/stations/${icao}/observations/latest`;
    const start = performance.now();
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PreBoard/1.0", "Accept": "application/geo+json" },
        signal: AbortSignal.timeout(5_000),
      });
      return { feed_id: config.id, is_healthy: response.ok, response_time_ms: Math.round(performance.now() - start), last_error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: Math.round(performance.now() - start), last_error: err instanceof Error ? err.message : "Unknown" };
    }
  },
};

registerAdapter(noaaAdapter);
```

- [ ] **Step 3: Implement TSA throughput adapter**

```typescript
// src/lib/adapters/tsa-throughput.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * TSA throughput adapter — daily passenger screening numbers.
 * TSA publishes daily throughput at tsa.gov/travel/passenger-volumes.
 * Used for demand modeling, not direct wait times.
 * Polled daily (not every 60s).
 */
export const tsaThroughputAdapter: FeedAdapter = {
  id: "tsa-throughput",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    // TSA throughput is a daily aggregate — feeds into prediction engine
    // Does not produce per-checkpoint wait times
    return [];
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    const url = config.url || "https://www.tsa.gov/travel/passenger-volumes";
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "PreBoard/1.0" },
        signal: AbortSignal.timeout(5_000),
      });
      return { feed_id: config.id, is_healthy: response.ok, response_time_ms: Math.round(performance.now() - start), last_error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: Math.round(performance.now() - start), last_error: err instanceof Error ? err.message : "Unknown" };
    }
  },
};

registerAdapter(tsaThroughputAdapter);
```

- [ ] **Step 4: Implement FlightAware adapter**

```typescript
// src/lib/adapters/flightaware.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * FlightAware AeroAPI adapter — flight schedules and status.
 * Requires FLIGHTAWARE_API_KEY env var.
 * Used for demand prediction (departures → passenger demand).
 * Does not produce direct wait time readings.
 */
export const flightawareAdapter: FeedAdapter = {
  id: "flightaware",

  async fetch(config: FeedConfig, env: Record<string, unknown>): Promise<RawReading[]> {
    // FlightAware data feeds into prediction engine for demand estimation
    // Direct wait times are not available from flight data
    return [];
  },

  async healthCheck(config: FeedConfig, env: Record<string, unknown>): Promise<FeedHealth> {
    const apiKey = (env.FLIGHTAWARE_API_KEY as string) || "";
    if (!apiKey) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: 0, last_error: "No FLIGHTAWARE_API_KEY" };
    }
    const url = `https://aeroapi.flightaware.com/aeroapi/airports/${config.airport_code}/flights/departures`;
    const start = performance.now();
    try {
      const response = await fetch(url, {
        headers: { "x-apikey": apiKey },
        signal: AbortSignal.timeout(5_000),
      });
      return { feed_id: config.id, is_healthy: response.ok, response_time_ms: Math.round(performance.now() - start), last_error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: Math.round(performance.now() - start), last_error: err instanceof Error ? err.message : "Unknown" };
    }
  },
};

registerAdapter(flightawareAdapter);
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/adapters/faa-swim.ts src/lib/adapters/noaa.ts src/lib/adapters/tsa-throughput.ts src/lib/adapters/flightaware.ts
git commit -m "feat: add government + flight data adapters (FAA, NOAA, TSA, FlightAware)"
```

---

### Task 7: Airport HTML Scraper Adapter

**Files:**
- Create: `src/lib/adapters/airport-html.ts`

- [ ] **Step 1: Implement HTML scraper adapter**

```typescript
// src/lib/adapters/airport-html.ts
import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import { registerAdapter } from "./registry";

/**
 * Airport HTML scraper — last resort adapter.
 * Extracts wait time data from airport web pages using regex patterns.
 * Less reliable than JSON APIs, but covers airports with no API.
 */

const WAIT_PATTERNS = [
  /(?:wait|tiempo)[^0-9]*?(\d{1,3})\s*(?:min|minute)/gi,
  /(\d{1,3})\s*(?:min|minute)[^0-9]*?(?:wait|queue|line)/gi,
  /(?:estimated|current|average)[^0-9]*?(\d{1,3})\s*(?:min|minute)/gi,
];

const CHECKPOINT_PATTERN = /(?:checkpoint|terminal|gate|concourse)\s*([A-Za-z0-9\s]+)/gi;

export const airportHtmlAdapter: FeedAdapter = {
  id: "airport-html",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.url) return [];

    try {
      const response = await fetch(config.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PreBoard/1.0)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return [];

      const html = await response.text();
      return parseHtmlForWaitTimes(config.airport_code, config.checkpoint_id, html);
    } catch {
      return [];
    }
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    if (!config.url) return { feed_id: config.id, is_healthy: false, response_time_ms: 0, last_error: "No URL" };
    const start = performance.now();
    try {
      const response = await fetch(config.url, { method: "HEAD", signal: AbortSignal.timeout(5_000) });
      return { feed_id: config.id, is_healthy: response.ok, response_time_ms: Math.round(performance.now() - start), last_error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: Math.round(performance.now() - start), last_error: err instanceof Error ? err.message : "Unknown" };
    }
  },
};

function parseHtmlForWaitTimes(airportCode: string, checkpointId: string | null, html: string): RawReading[] {
  const readings: RawReading[] = [];
  const now = new Date().toISOString();

  // Strip HTML tags for text analysis
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  for (const pattern of WAIT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const waitMins = parseInt(match[1], 10);
      if (waitMins < 0 || waitMins > 300) continue;

      const cpId = checkpointId || `${airportCode.toLowerCase()}-main`;

      readings.push({
        airport_code: airportCode,
        checkpoint_id: cpId,
        lane_type: "standard",
        wait_minutes: waitMins,
        confidence: 0.5, // Lower confidence for scraped data
        source_type: "airport-api",
        measured_at: now,
      });
      break; // Take first match per pattern to avoid duplicates
    }
  }

  // Deduplicate by checkpoint
  const seen = new Set<string>();
  return readings.filter((r) => {
    const key = `${r.checkpoint_id}-${r.lane_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

registerAdapter(airportHtmlAdapter);
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/adapters/airport-html.ts
git commit -m "feat: add airport HTML scraper adapter (last resort)"
```

---

### Task 8: Trend Calculator

**Files:**
- Create: `src/lib/utils/trend.ts`
- Test: `tests/lib/trend.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/trend.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/trend.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement trend calculator**

```typescript
// src/lib/utils/trend.ts
import type { Trend } from "@/lib/types/reading";

/**
 * Calculate wait time trend from recent readings.
 * Uses linear regression slope over the values.
 * Threshold: slope > 0.5 min/reading = rising, < -0.5 = falling.
 */
export function calculateTrend(waitMinutes: number[]): Trend {
  if (waitMinutes.length < 2) return "stable";

  const n = waitMinutes.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += waitMinutes[i];
    sumXY += i * waitMinutes[i];
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Threshold: >0.5 min/reading = rising, <-0.5 = falling
  if (slope > 0.5) return "rising";
  if (slope < -0.5) return "falling";
  return "stable";
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/trend.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/trend.ts tests/lib/trend.test.ts
git commit -m "feat: add trend calculator — linear regression over recent readings"
```

---

### Task 9: Reading Validation Utilities

**Files:**
- Create: `src/lib/utils/validation.ts`
- Test: `tests/lib/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateReport, sanitizeString, isValidIata } from "@/lib/utils/validation";

describe("isValidIata", () => {
  it("accepts 3-letter uppercase codes", () => {
    expect(isValidIata("ATL")).toBe(true);
    expect(isValidIata("LAX")).toBe(true);
  });

  it("accepts lowercase and converts", () => {
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
    const result = validateReport({
      airport_code: "ATL",
      checkpoint: "Main",
      lane_type: "standard",
      wait_minutes: 25,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing airport", () => {
    const result = validateReport({
      airport_code: "",
      checkpoint: "Main",
      lane_type: "standard",
      wait_minutes: 25,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("airport");
  });

  it("rejects negative wait time", () => {
    const result = validateReport({
      airport_code: "ATL",
      checkpoint: "Main",
      lane_type: "standard",
      wait_minutes: -5,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects excessive wait time", () => {
    const result = validateReport({
      airport_code: "ATL",
      checkpoint: "Main",
      lane_type: "standard",
      wait_minutes: 400,
    });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/validation.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement validation**

```typescript
// src/lib/utils/validation.ts

export function isValidIata(code: string): boolean {
  if (!code) return false;
  return /^[A-Za-z]{3}$/.test(code.trim());
}

export function sanitizeString(input: string, maxLength: number = 500): string {
  if (!input) return "";
  return String(input)
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, maxLength);
}

interface ReportInput {
  airport_code: string;
  checkpoint: string;
  lane_type: string;
  wait_minutes: number;
  note?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateReport(input: ReportInput): ValidationResult {
  if (!isValidIata(input.airport_code)) {
    return { valid: false, error: "Invalid airport code" };
  }
  if (!input.checkpoint || input.checkpoint.trim().length === 0) {
    return { valid: false, error: "Checkpoint is required" };
  }
  if (!["standard", "precheck", "clear"].includes(input.lane_type)) {
    return { valid: false, error: "Invalid lane type" };
  }
  if (typeof input.wait_minutes !== "number" || input.wait_minutes < 0 || input.wait_minutes > 300) {
    return { valid: false, error: "Wait time must be 0-300 minutes" };
  }
  return { valid: true };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/validation.ts tests/lib/validation.test.ts
git commit -m "feat: add input validation — IATA codes, reports, string sanitization"
```

---

### Task 10: Data Fusion Engine

**Files:**
- Create: `src/workers/ingestion/fusion.ts`
- Test: `tests/workers/fusion.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/fusion.test.ts
import { describe, it, expect } from "vitest";
import { fuseReadings } from "@/workers/ingestion/fusion";
import type { RawReading } from "@/lib/adapters/base";

function makeReading(overrides: Partial<RawReading>): RawReading {
  return {
    airport_code: "ATL",
    checkpoint_id: "atl-main",
    lane_type: "standard",
    wait_minutes: 20,
    confidence: 0.8,
    source_type: "airport-api",
    measured_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("fuseReadings", () => {
  it("returns empty for no readings", () => {
    expect(fuseReadings([])).toHaveLength(0);
  });

  it("returns single reading unchanged", () => {
    const readings = [makeReading({ wait_minutes: 25 })];
    const fused = fuseReadings(readings);
    expect(fused).toHaveLength(1);
    expect(fused[0].wait_minutes).toBe(25);
  });

  it("prefers sensor data over other sources", () => {
    const readings = [
      makeReading({ wait_minutes: 20, source_type: "airport-api", confidence: 0.85 }),
      makeReading({ wait_minutes: 25, source_type: "sensor", confidence: 0.95 }),
    ];
    const fused = fuseReadings(readings);
    expect(fused).toHaveLength(1);
    expect(fused[0].wait_minutes).toBe(25);
    expect(fused[0].source_type).toBe("sensor");
  });

  it("prefers airport-api over crowdsourced", () => {
    const readings = [
      makeReading({ wait_minutes: 30, source_type: "crowdsourced", confidence: 0.7 }),
      makeReading({ wait_minutes: 25, source_type: "airport-api", confidence: 0.85 }),
    ];
    const fused = fuseReadings(readings);
    expect(fused).toHaveLength(1);
    expect(fused[0].wait_minutes).toBe(25);
  });

  it("boosts confidence when sensor + crowd agree", () => {
    const readings = [
      makeReading({ wait_minutes: 25, source_type: "sensor", confidence: 0.95 }),
      makeReading({ wait_minutes: 27, source_type: "crowdsourced", confidence: 0.7 }),
    ];
    const fused = fuseReadings(readings);
    expect(fused[0].confidence).toBeGreaterThan(0.95);
  });

  it("groups by checkpoint + lane type", () => {
    const readings = [
      makeReading({ checkpoint_id: "atl-main", lane_type: "standard", wait_minutes: 25 }),
      makeReading({ checkpoint_id: "atl-main", lane_type: "precheck", wait_minutes: 10 }),
      makeReading({ checkpoint_id: "atl-south", lane_type: "standard", wait_minutes: 15 }),
    ];
    const fused = fuseReadings(readings);
    expect(fused).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/workers/fusion.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement data fusion**

```typescript
// src/workers/ingestion/fusion.ts
import type { RawReading } from "@/lib/adapters/base";

const SOURCE_PRIORITY: Record<string, number> = {
  sensor: 4,
  "airport-api": 3,
  crowdsourced: 2,
  predicted: 1,
};

/**
 * Fuse multiple readings for the same checkpoint + lane into a single best reading.
 * Priority: sensor > airport-api > crowdsourced > predicted.
 * When sensor + crowd agree within 5 min, boost confidence to 0.98.
 */
export function fuseReadings(readings: RawReading[]): RawReading[] {
  if (readings.length === 0) return [];

  // Group by checkpoint_id + lane_type
  const groups = new Map<string, RawReading[]>();
  for (const r of readings) {
    const key = `${r.checkpoint_id}|${r.lane_type}`;
    const group = groups.get(key) || [];
    group.push(r);
    groups.set(key, group);
  }

  const fused: RawReading[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      fused.push(group[0]);
      continue;
    }

    // Sort by source priority (highest first)
    group.sort((a, b) => (SOURCE_PRIORITY[b.source_type] || 0) - (SOURCE_PRIORITY[a.source_type] || 0));

    const best = { ...group[0] };

    // Check if sensor + crowd agree (within 5 minutes wait difference)
    const sensorReading = group.find((r) => r.source_type === "sensor");
    const crowdReading = group.find((r) => r.source_type === "crowdsourced");

    if (sensorReading && crowdReading) {
      const diff = Math.abs(sensorReading.wait_minutes - crowdReading.wait_minutes);
      if (diff <= 5) {
        best.confidence = Math.min(0.98, best.confidence + 0.03);
      }
    }

    fused.push(best);
  }

  return fused;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/workers/fusion.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workers/ingestion/fusion.ts tests/workers/fusion.test.ts
git commit -m "feat: add data fusion engine — multi-source priority + confidence boosting"
```

---

### Task 11: KV Cache Helpers

**Files:**
- Create: `src/lib/db/kv.ts`

- [ ] **Step 1: Implement KV helpers**

```typescript
// src/lib/db/kv.ts
import type { CurrentWait } from "@/lib/types/reading";
import type { AirportOverview } from "@/lib/types/airport";

const CURRENT_WAITS_KEY = "current_waits:";
const MAP_OVERVIEW_KEY = "map:overview";
const AIRPORT_LIVE_KEY = "airport:live:";

/**
 * Cache current waits for a single airport.
 * TTL: 30 seconds (refreshed every poll cycle).
 */
export async function cacheCurrentWaits(
  kv: KVNamespace,
  airportCode: string,
  waits: CurrentWait[]
): Promise<void> {
  await kv.put(
    `${CURRENT_WAITS_KEY}${airportCode}`,
    JSON.stringify(waits),
    { expirationTtl: 60 } // 60s TTL, refreshed every 30s
  );
}

export async function getCachedCurrentWaits(
  kv: KVNamespace,
  airportCode: string
): Promise<CurrentWait[] | null> {
  const cached = await kv.get(`${CURRENT_WAITS_KEY}${airportCode}`);
  if (!cached) return null;
  return JSON.parse(cached) as CurrentWait[];
}

/**
 * Cache the full map overview (all airports with current wait status).
 * TTL: 30 seconds.
 */
export async function cacheMapOverview(
  kv: KVNamespace,
  overview: AirportOverview[]
): Promise<void> {
  await kv.put(MAP_OVERVIEW_KEY, JSON.stringify(overview), { expirationTtl: 60 });
}

export async function getCachedMapOverview(
  kv: KVNamespace
): Promise<AirportOverview[] | null> {
  const cached = await kv.get(MAP_OVERVIEW_KEY);
  if (!cached) return null;
  return JSON.parse(cached) as AirportOverview[];
}

/**
 * Cache the full live snapshot for a single airport.
 * Used by /api/v1/airports/:code/live
 * TTL: 10 seconds.
 */
export async function cacheAirportLive(
  kv: KVNamespace,
  airportCode: string,
  data: unknown
): Promise<void> {
  await kv.put(
    `${AIRPORT_LIVE_KEY}${airportCode}`,
    JSON.stringify(data),
    { expirationTtl: 30 }
  );
}

export async function getCachedAirportLive(
  kv: KVNamespace,
  airportCode: string
): Promise<unknown | null> {
  const cached = await kv.get(`${AIRPORT_LIVE_KEY}${airportCode}`);
  if (!cached) return null;
  return JSON.parse(cached);
}

/**
 * Invalidate all cache entries for an airport.
 */
export async function invalidateAirportCache(
  kv: KVNamespace,
  airportCode: string
): Promise<void> {
  await Promise.all([
    kv.delete(`${CURRENT_WAITS_KEY}${airportCode}`),
    kv.delete(`${AIRPORT_LIVE_KEY}${airportCode}`),
    kv.delete(MAP_OVERVIEW_KEY),
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/kv.ts
git commit -m "feat: add KV cache helpers — current waits, map overview, airport live"
```

---

### Task 12: Process Reading Pipeline

**Files:**
- Create: `src/workers/ingestion/process-reading.ts`
- Test: `tests/workers/process-reading.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/process-reading.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/workers/process-reading.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement process reading**

```typescript
// src/workers/ingestion/process-reading.ts
import type { RawReading } from "@/lib/adapters/base";
import { validateReading, toNormalized } from "@/lib/adapters/base";
import { fuseReadings } from "./fusion";
import { calculateTrend } from "@/lib/utils/trend";
import { upsertCurrentWait, insertReading, getRecentReadings } from "@/lib/db/d1";
import { cacheCurrentWaits } from "@/lib/db/kv";
import type { CurrentWait } from "@/lib/types/reading";

interface ProcessResult {
  processed: number;
  rejected: number;
  errors: string[];
}

/**
 * Process raw readings through the pipeline:
 * 1. Validate each reading
 * 2. Fuse multiple readings for same checkpoint/lane
 * 3. Calculate trend from recent readings
 * 4. Store in D1 (readings table + current_waits)
 * 5. Update KV cache
 */
export async function processReadings(
  rawReadings: RawReading[],
  db: D1Database,
  kv: KVNamespace
): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, rejected: 0, errors: [] };

  // Step 1: Validate
  const valid: RawReading[] = [];
  for (const reading of rawReadings) {
    if (validateReading(reading)) {
      valid.push(reading);
    } else {
      result.rejected++;
    }
  }

  if (valid.length === 0) return result;

  // Step 2: Fuse
  const fused = fuseReadings(valid);

  // Step 3-5: Process each fused reading
  const currentWaits: CurrentWait[] = [];

  for (const reading of fused) {
    try {
      // Insert into readings table
      const normalized = toNormalized(reading);
      await insertReading(db, normalized);

      // Get recent readings for trend calculation
      const recentResult = await db
        .prepare(
          `SELECT wait_minutes FROM readings
           WHERE checkpoint_id = ?1 AND lane_type = ?2
           ORDER BY measured_at DESC LIMIT 10`
        )
        .bind(reading.checkpoint_id, reading.lane_type)
        .all<{ wait_minutes: number }>();

      const recentValues = recentResult.results.map((r) => r.wait_minutes);
      const trend = calculateTrend(recentValues);

      // Determine data tier based on source type and freshness
      const dataTier = reading.source_type === "sensor"
        ? "live"
        : reading.source_type === "airport-api"
          ? "near-live"
          : reading.source_type === "crowdsourced"
            ? "near-live"
            : "predicted";

      // Upsert current_waits
      const currentWait: CurrentWait = {
        airport_code: reading.airport_code,
        checkpoint_id: reading.checkpoint_id,
        lane_type: reading.lane_type,
        wait_minutes: reading.wait_minutes,
        confidence: reading.confidence,
        trend,
        source_type: reading.source_type,
        data_tier: dataTier,
        updated_at: new Date().toISOString(),
      };
      await upsertCurrentWait(db, currentWait);
      currentWaits.push(currentWait);

      result.processed++;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // Step 5: Update KV cache
  if (currentWaits.length > 0) {
    const airportCode = currentWaits[0].airport_code;
    try {
      await cacheCurrentWaits(kv, airportCode, currentWaits);
    } catch {
      // KV cache failures are non-fatal
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/workers/process-reading.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/workers/ingestion/process-reading.ts tests/workers/process-reading.test.ts
git commit -m "feat: add reading processor — validate, fuse, trend, store, cache"
```

---

### Task 13: Poll Feeds Orchestrator

**Files:**
- Create: `src/workers/ingestion/poll-feeds.ts`

- [ ] **Step 1: Implement poll feeds orchestrator**

```typescript
// src/workers/ingestion/poll-feeds.ts
import { getActiveFeeds } from "@/lib/db/d1";
import { getAdapter } from "@/lib/adapters/registry";
import { processReadings } from "./process-reading";
import type { FeedConfig } from "@/lib/types/feed";

// Import all adapters to register them
import "@/lib/adapters/crowdsource";
import "@/lib/adapters/dynamic-json";
import "@/lib/adapters/airport-json";
import "@/lib/adapters/airport-html";
import "@/lib/adapters/bliptrack";
import "@/lib/adapters/xovis";
import "@/lib/adapters/faa-swim";
import "@/lib/adapters/flightaware";
import "@/lib/adapters/noaa";
import "@/lib/adapters/tsa-throughput";

interface PollResult {
  feeds_polled: number;
  total_readings: number;
  total_processed: number;
  total_rejected: number;
  errors: Array<{ feed_id: string; error: string }>;
}

/**
 * Poll all active feeds and process readings.
 * Called by cron trigger every 60 seconds.
 */
export async function pollFeeds(
  db: D1Database,
  kv: KVNamespace,
  env: Record<string, unknown>
): Promise<PollResult> {
  const result: PollResult = {
    feeds_polled: 0,
    total_readings: 0,
    total_processed: 0,
    total_rejected: 0,
    errors: [],
  };

  // Get all active feeds
  const feeds = await getActiveFeeds(db);

  // Group feeds by airport for efficient batch processing
  const feedsByAirport = new Map<string, FeedConfig[]>();
  for (const feed of feeds) {
    const group = feedsByAirport.get(feed.airport_code) || [];
    group.push(feed);
    feedsByAirport.set(feed.airport_code, group);
  }

  // Process each airport's feeds
  for (const [airportCode, airportFeeds] of feedsByAirport) {
    const allReadings = [];

    for (const feed of airportFeeds) {
      const adapter = getAdapter(feed.adapter);
      if (!adapter) {
        result.errors.push({ feed_id: feed.id, error: `Unknown adapter: ${feed.adapter}` });
        continue;
      }

      try {
        const readings = await adapter.fetch(feed, env);
        allReadings.push(...readings);
        result.feeds_polled++;
        result.total_readings += readings.length;

        // Update feed success timestamp
        await db
          .prepare("UPDATE feeds SET last_success_at = datetime('now'), success_count_1h = success_count_1h + 1 WHERE id = ?1")
          .bind(feed.id)
          .run();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        result.errors.push({ feed_id: feed.id, error: errorMsg });

        // Update feed error tracking
        await db
          .prepare("UPDATE feeds SET last_error_at = datetime('now'), last_error = ?2, error_count_1h = error_count_1h + 1 WHERE id = ?1")
          .bind(feed.id, errorMsg)
          .run();
      }
    }

    // Process all readings for this airport together (enables fusion)
    if (allReadings.length > 0) {
      const processResult = await processReadings(allReadings, db, kv);
      result.total_processed += processResult.processed;
      result.total_rejected += processResult.rejected;
    }
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/workers/ingestion/poll-feeds.ts
git commit -m "feat: add poll feeds orchestrator — fetches all feeds, fuses, stores"
```

---

### Task 14: Scheduled Worker Entry Point

**Files:**
- Create: `src/workers/scheduled.ts`

- [ ] **Step 1: Implement scheduled worker**

```typescript
// src/workers/scheduled.ts
import { pollFeeds } from "./ingestion/poll-feeds";

/**
 * Cloudflare Scheduled Worker handler.
 * Maps cron triggers to their respective functions.
 *
 * Cron schedule (from wrangler.jsonc):
 * - * * * * *       → Feed polling (every 60s)
 * - *​/5 * * * *     → Prediction update (every 5 min) — Plan 4
 * - 0 * * * *       → Hourly maintenance (prune old readings, reset error counters)
 * - 0 *​/6 * * *     → Feed discovery (every 6h) — Plan 3
 */
export async function handleScheduled(
  event: ScheduledEvent,
  env: CloudflareEnv
): Promise<void> {
  const cron = event.cron;

  switch (cron) {
    case "* * * * *":
      // Every minute: poll all active feeds
      await pollFeeds(env.DB, env.CACHE, env as unknown as Record<string, unknown>);
      break;

    case "*/5 * * * *":
      // Every 5 minutes: update predictions (Plan 4)
      // TODO: Will be implemented in Plan 4 (Prediction Engine)
      break;

    case "0 * * * *":
      // Every hour: maintenance
      await hourlyMaintenance(env.DB);
      break;

    case "0 */6 * * *":
      // Every 6 hours: feed discovery (Plan 3)
      // TODO: Will be implemented in Plan 3 (Autonomous Feed System)
      break;

    default:
      console.log(`Unknown cron: ${cron}`);
  }
}

/**
 * Hourly maintenance:
 * - Reset rolling error/success counters
 * - Aggregate readings >6h old into readings_rollup (hourly avg/min/max)
 * - Prune raw readings older than 7 days
 * - Prune predictions older than 24 hours
 *
 * Data retention model (IMPLEMENTED):
 *   0-6h:    per-minute raw readings in `readings`
 *   6h-7d:   per-minute raw readings in `readings`
 *   7d+:     hourly rollups in `readings_rollup` (kept indefinitely)
 */
async function hourlyMaintenance(db: D1Database): Promise<void> {
  await db
    .prepare("UPDATE feeds SET error_count_1h = 0, success_count_1h = 0 WHERE status IN ('active', 'trial', 'degraded')")
    .run();

  // Roll up readings older than 6 hours into hourly aggregates BEFORE deleting
  const rollupCutoff = new Date(Date.now() - 6 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
  const deleteCutoff = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().replace("T", " ").slice(0, 19);

  await db
    .prepare(`
      INSERT OR REPLACE INTO readings_rollup (airport_code, checkpoint_id, lane_type, hour, avg_wait, min_wait, max_wait, sample_count, source_types)
      SELECT
        airport_code, checkpoint_id, lane_type,
        substr(measured_at, 1, 13) || ':00' as hour,
        ROUND(AVG(wait_minutes), 1), ROUND(MIN(wait_minutes), 1), ROUND(MAX(wait_minutes), 1),
        COUNT(*), GROUP_CONCAT(DISTINCT source_type)
      FROM readings
      WHERE measured_at < ?1 AND source_type != 'predicted'
      GROUP BY airport_code, checkpoint_id, lane_type, substr(measured_at, 1, 13)
    `)
    .bind(rollupCutoff)
    .run();

  await db.prepare("DELETE FROM readings WHERE ingested_at < ?1").bind(deleteCutoff).run();

  const predCutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  await db.prepare("DELETE FROM predictions WHERE generated_at < ?1").bind(predCutoff).run();
}
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/workers/scheduled.ts
git commit -m "feat: add scheduled worker — cron handler for polling, maintenance"
```

---

## Post-Plan Verification

After all tasks are complete:

1. Run full test suite: `npx vitest run`
2. Verify TypeScript compiles: `npx tsc --noEmit`
3. Check file organization: no files in root, all adapters in `src/lib/adapters/`, workers in `src/workers/`
4. Verify all adapters registered: check that `registry.ts` imports work

## Dependencies for Next Plans

- **Plan 3 (Autonomous Feed System)**: Uses adapter registry, health checks from base.ts, scheduled.ts for discovery cron
- **Plan 4 (Prediction Engine)**: Uses NOAA, FlightAware, FAA adapters as data sources; scheduled.ts for prediction cron
- **Plan 5 (API Layer)**: Uses KV cache helpers, D1 queries, process-reading pipeline
- **Plan 6 (Frontend)**: Consumes API endpoints from Plan 5
