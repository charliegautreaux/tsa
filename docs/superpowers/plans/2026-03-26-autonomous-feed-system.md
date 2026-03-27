# Autonomous Feed System Implementation Plan (Plan 3 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the autonomous feed lifecycle — discover new feeds, validate them through 24h trials, auto-activate reliable feeds, monitor health continuously, and self-heal degraded feeds.

**Architecture:** Discovery scanner runs every 6h probing airport domains. Validator runs feeds through 24h trials. Health monitor tracks per-feed metrics every poll cycle. Self-healer degrades/deactivates/retries feeds based on error rates.

**Tech Stack:** TypeScript, Cloudflare Workers (D1), vitest

---

## File Structure

```
src/
├── workers/
│   ├── discovery/
│   │   ├── scanner.ts           ← Probe airports for new feeds
│   │   ├── validator.ts         ← Test discovered feeds (24h trial)
│   │   └── faa-sync.ts          ← FAA registry sync
│   ├── health/
│   │   ├── monitor.ts           ← Feed health tracking per poll cycle
│   │   └── self-heal.ts         ← Auto-recovery logic
│   └── scheduled.ts             ← Update cron handlers (modify existing)
├── lib/
│   ├── db/
│   │   └── d1.ts                ← Add new query helpers (modify existing)
│   └── config/
│       └── discovery.config.ts  ← URL patterns + discovery settings
tests/
├── workers/
│   ├── discovery/
│   │   ├── scanner.test.ts
│   │   └── validator.test.ts
│   └── health/
│       ├── monitor.test.ts
│       └── self-heal.test.ts
```

---

### Task 1: Discovery Configuration

**Files:**
- Create: `src/lib/config/discovery.config.ts`

- [ ] **Step 1: Create discovery configuration**

```typescript
// src/lib/config/discovery.config.ts

/** URL patterns to probe on airport domains */
export const PROBE_URL_PATTERNS = [
  "/api/wait-times",
  "/api/security/wait-times",
  "/api/v1/security",
  "/api/tsa",
  "/api/checkpoint",
  "/security/wait-times",
  "/tsa/wait-times.json",
  "/data/security.json",
  "/feeds/security",
  "/api/security-wait",
  "/_api/security",
  "/api/passenger/wait-times",
  "/services/security/times",
  "/waittimes",
  "/wait-times.json",
  "/security-status.json",
  "/api/status/security",
  "/checkpoint/status",
  "/api/queue/times",
  "/real-time/security",
];

/** Common airport domain patterns */
export const AIRPORT_DOMAIN_PATTERNS = [
  "fly{code}.com",
  "{code}airport.com",
  "{code}.aero",
  "www.fly{code}.com",
  "{city}airport.com",
  "{code}-airport.com",
];

/** Sitemap keywords that suggest wait time content */
export const SITEMAP_KEYWORDS = [
  "wait", "security", "queue", "checkpoint", "tsa", "screening", "line",
];

/** Discovery scoring thresholds */
export const DISCOVERY_THRESHOLDS = {
  /** Minimum probe score to consider a feed valid (0-1) */
  MIN_PROBE_SCORE: 0.7,
  /** Minimum reliability score after 24h trial to auto-activate */
  MIN_RELIABILITY_SCORE: 0.75,
  /** Number of trial polls before evaluation */
  TRIAL_POLL_COUNT: 288, // 24h at 5min intervals
  /** Max number of airports to scan per discovery run */
  MAX_AIRPORTS_PER_RUN: 50,
  /** Max concurrent probes per run */
  MAX_CONCURRENT_PROBES: 5,
};

/** Wait time scoring heuristics for probe responses */
export const PROBE_SCORING = {
  /** Keywords that boost score */
  POSITIVE_KEYWORDS: ["wait", "time", "minute", "queue", "checkpoint", "security", "lane", "precheck", "clear"],
  /** Number ranges typical of wait times (minutes) */
  VALID_WAIT_RANGE: { min: 0, max: 180 },
  /** Minimum fields to consider valid */
  MIN_FIELDS: 2,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/config/discovery.config.ts
git commit -m "feat: add discovery configuration — URL patterns, scoring thresholds"
```

---

### Task 2: Feed DB Query Helpers (extend d1.ts)

**Files:**
- Modify: `src/lib/db/d1.ts` — add feed management queries

- [ ] **Step 1: Add new query helpers to d1.ts**

Append these functions to the existing `src/lib/db/d1.ts`:

```typescript
// ============================================================
// FEED MANAGEMENT (for discovery + health)
// ============================================================

export async function insertFeed(db: D1Database, feed: {
  id: string;
  airport_code: string;
  checkpoint_id: string | null;
  type: string;
  adapter: string;
  url: string | null;
  auth_config: string;
  polling_interval_sec: number;
  dynamic_mapping: string | null;
  status: string;
  discovered_by: string;
}): Promise<void> {
  await db
    .prepare(`
      INSERT INTO feeds (id, airport_code, checkpoint_id, type, adapter, url, auth_config, polling_interval_sec, dynamic_mapping, status, discovered_by)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      ON CONFLICT(id) DO NOTHING
    `)
    .bind(feed.id, feed.airport_code, feed.checkpoint_id, feed.type, feed.adapter, feed.url, feed.auth_config, feed.polling_interval_sec, feed.dynamic_mapping, feed.status, feed.discovered_by)
    .run();
}

export async function updateFeedStatus(db: D1Database, feedId: string, status: string): Promise<void> {
  await db
    .prepare("UPDATE feeds SET status = ?2, updated_at = datetime('now') WHERE id = ?1")
    .bind(feedId, status)
    .run();
}

export async function updateFeedReliability(db: D1Database, feedId: string, score: number): Promise<void> {
  await db
    .prepare("UPDATE feeds SET reliability_score = ?2, updated_at = datetime('now') WHERE id = ?1")
    .bind(feedId, score)
    .run();
}

export async function getTrialFeeds(db: D1Database): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE status = 'trial' ORDER BY trial_start_at")
    .all<Record<string, unknown>>();
  return result.results.map(parseFeedConfig);
}

export async function getDegradedFeeds(db: D1Database): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE status = 'degraded' ORDER BY last_error_at")
    .all<Record<string, unknown>>();
  return result.results.map(parseFeedConfig);
}

export async function getInactiveFeeds(db: D1Database): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE status IN ('inactive', 'dormant') ORDER BY last_success_at")
    .all<Record<string, unknown>>();
  return result.results.map(parseFeedConfig);
}

export async function getFeedById(db: D1Database, feedId: string): Promise<FeedConfig | null> {
  const row = await db
    .prepare("SELECT * FROM feeds WHERE id = ?1")
    .bind(feedId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return parseFeedConfig(row);
}

export async function getFeedErrorRate(db: D1Database, feedId: string): Promise<{ error_count: number; success_count: number }> {
  const row = await db
    .prepare("SELECT error_count_1h as error_count, success_count_1h as success_count FROM feeds WHERE id = ?1")
    .bind(feedId)
    .first<{ error_count: number; success_count: number }>();
  return row || { error_count: 0, success_count: 0 };
}

// ============================================================
// DISCOVERY LOG
// ============================================================

export async function insertDiscoveryLog(db: D1Database, entry: {
  url: string;
  airport_code: string | null;
  discovered_by: string;
  probe_score: number | null;
  adapter_detected: string | null;
  status: string;
}): Promise<void> {
  await db
    .prepare(`
      INSERT INTO discovery_log (url, airport_code, discovered_by, probe_score, adapter_detected, status)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `)
    .bind(entry.url, entry.airport_code, entry.discovered_by, entry.probe_score, entry.adapter_detected, entry.status)
    .run();
}

export async function getDiscoveryLogForUrl(db: D1Database, url: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM discovery_log WHERE url = ?1 LIMIT 1")
    .bind(url)
    .first();
  return row !== null;
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass (new functions are additive)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/d1.ts
git commit -m "feat: add feed management and discovery log DB helpers"
```

---

### Task 3: Feed Probe + Score (Discovery Scanner)

**Files:**
- Create: `src/workers/discovery/scanner.ts`
- Test: `tests/workers/discovery/scanner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/discovery/scanner.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { probeUrl, scoreResponse, runDiscoveryScan } from "@/workers/discovery/scanner";

describe("scoreResponse", () => {
  it("scores valid wait time JSON highly", () => {
    const json = {
      checkpoints: [
        { name: "Main", waitTime: 25, laneType: "standard" },
      ],
    };
    const score = scoreResponse(json);
    expect(score).toBeGreaterThan(0.7);
  });

  it("scores irrelevant JSON low", () => {
    const json = { menu: "food", price: 12.99 };
    const score = scoreResponse(json);
    expect(score).toBeLessThan(0.3);
  });

  it("scores empty response as 0", () => {
    expect(scoreResponse(null)).toBe(0);
    expect(scoreResponse({})).toBeLessThan(0.3);
  });
});

describe("probeUrl", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("returns probe result for valid endpoint", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      headers: new Map([["content-type", "application/json"]]),
      json: () => Promise.resolve({
        checkpoints: [{ name: "Main", waitTime: 15 }],
      }),
    });

    const result = await probeUrl("https://example.com/api/wait-times", "ATL");
    expect(result.reachable).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it("returns failed probe for unreachable URL", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    const result = await probeUrl("https://example.com/bad", "ATL");
    expect(result.reachable).toBe(false);
    expect(result.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/workers/discovery/scanner.test.ts`

- [ ] **Step 3: Implement scanner**

```typescript
// src/workers/discovery/scanner.ts
import { PROBE_URL_PATTERNS, PROBE_SCORING, DISCOVERY_THRESHOLDS, AIRPORT_DOMAIN_PATTERNS } from "@/lib/config/discovery.config";
import { getAllAirports, insertFeed, insertDiscoveryLog, getDiscoveryLogForUrl } from "@/lib/db/d1";
import type { Airport } from "@/lib/types/airport";

export interface ProbeResult {
  url: string;
  reachable: boolean;
  score: number;
  contentType: string | null;
  adapterDetected: string | null;
}

/** Score a JSON response for wait-time-like data */
export function scoreResponse(json: unknown): number {
  if (json == null) return 0;
  if (typeof json !== "object") return 0;

  const text = JSON.stringify(json).toLowerCase();
  let score = 0;
  let matchCount = 0;

  // Check for positive keywords
  for (const keyword of PROBE_SCORING.POSITIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 0.1;
      matchCount++;
    }
  }

  // Check for numbers in wait time range
  const numbers = text.match(/\d+/g)?.map(Number) || [];
  const validNumbers = numbers.filter(
    (n) => n >= PROBE_SCORING.VALID_WAIT_RANGE.min && n <= PROBE_SCORING.VALID_WAIT_RANGE.max
  );
  if (validNumbers.length > 0) score += 0.2;

  // Check for timestamps (ISO format)
  if (/\d{4}-\d{2}-\d{2}/.test(text)) score += 0.1;

  // Check for array structure (multiple checkpoints)
  if (Array.isArray(json) || Object.values(json as Record<string, unknown>).some(Array.isArray)) {
    score += 0.1;
  }

  // Cap at 1.0
  return Math.min(1.0, score);
}

/** Probe a single URL and score the response */
export async function probeUrl(url: string, airportCode: string): Promise<ProbeResult> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "PreBoard/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return { url, reachable: false, score: 0, contentType: null, adapterDetected: null };
    }

    const contentType = response.headers.get("content-type") || "";
    let score = 0;
    let adapterDetected: string | null = null;

    if (contentType.includes("json")) {
      const json = await response.json();
      score = scoreResponse(json);
      adapterDetected = score > 0.5 ? "dynamic-json" : null;
    } else if (contentType.includes("html")) {
      const html = await response.text();
      // Basic check for wait time content in HTML
      const lower = html.toLowerCase();
      const hasWaitContent = PROBE_SCORING.POSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
      score = hasWaitContent ? 0.4 : 0.1;
      adapterDetected = hasWaitContent ? "airport-html" : null;
    }

    return { url, reachable: true, score, contentType, adapterDetected };
  } catch {
    return { url, reachable: false, score: 0, contentType: null, adapterDetected: null };
  }
}

/** Generate candidate URLs for an airport */
function generateProbeUrls(airport: Airport): string[] {
  const urls: string[] = [];
  const code = airport.iata.toLowerCase();
  const city = (airport.city || "").toLowerCase().replace(/\s+/g, "");

  for (const domainPattern of AIRPORT_DOMAIN_PATTERNS) {
    const domain = domainPattern.replace("{code}", code).replace("{city}", city);
    for (const path of PROBE_URL_PATTERNS) {
      urls.push(`https://${domain}${path}`);
    }
  }
  return urls;
}

/** Run a full discovery scan across airports */
export async function runDiscoveryScan(db: D1Database): Promise<{
  airports_scanned: number;
  urls_probed: number;
  feeds_discovered: number;
}> {
  const result = { airports_scanned: 0, urls_probed: 0, feeds_discovered: 0 };
  const airports = await getAllAirports(db);

  // Limit per run to avoid timeout
  const toScan = airports.slice(0, DISCOVERY_THRESHOLDS.MAX_AIRPORTS_PER_RUN);

  for (const airport of toScan) {
    result.airports_scanned++;
    const urls = generateProbeUrls(airport);

    for (const url of urls) {
      // Skip already-probed URLs
      const alreadyProbed = await getDiscoveryLogForUrl(db, url);
      if (alreadyProbed) continue;

      result.urls_probed++;
      const probe = await probeUrl(url, airport.iata);

      await insertDiscoveryLog(db, {
        url,
        airport_code: airport.iata,
        discovered_by: "known-pattern",
        probe_score: probe.score,
        adapter_detected: probe.adapterDetected,
        status: probe.score >= DISCOVERY_THRESHOLDS.MIN_PROBE_SCORE ? "trial" : "rejected",
      });

      // Auto-create trial feed if score is high enough
      if (probe.score >= DISCOVERY_THRESHOLDS.MIN_PROBE_SCORE && probe.adapterDetected) {
        const feedId = `${airport.iata.toLowerCase()}-discovered-${Date.now()}`;
        await insertFeed(db, {
          id: feedId,
          airport_code: airport.iata,
          checkpoint_id: null,
          type: "airport-web",
          adapter: probe.adapterDetected,
          url,
          auth_config: JSON.stringify({ type: "none" }),
          polling_interval_sec: 300, // 5 min during trial
          dynamic_mapping: null,
          status: "trial",
          discovered_by: "known-pattern",
        });
        result.feeds_discovered++;
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/workers/discovery/scanner.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/workers/discovery/scanner.ts tests/workers/discovery/scanner.test.ts src/lib/config/discovery.config.ts
git commit -m "feat: add feed discovery scanner — probe URLs, score responses, auto-create trial feeds"
```

---

### Task 4: Feed Validator (24h Trial)

**Files:**
- Create: `src/workers/discovery/validator.ts`
- Test: `tests/workers/discovery/validator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/discovery/validator.test.ts
import { describe, it, expect, vi } from "vitest";
import { evaluateTrialFeed, shouldActivate } from "@/workers/discovery/validator";

describe("shouldActivate", () => {
  it("activates when reliability is high enough", () => {
    expect(shouldActivate(0.8, 200, 10)).toBe(true);
  });

  it("rejects when reliability is too low", () => {
    expect(shouldActivate(0.5, 200, 100)).toBe(false);
  });

  it("rejects when not enough polls", () => {
    expect(shouldActivate(0.9, 5, 0)).toBe(false);
  });
});

describe("evaluateTrialFeed", () => {
  it("activates feed that meets threshold", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            error_count: 5,
            success_count: 250,
            trial_start_at: new Date(Date.now() - 25 * 3600_000).toISOString(),
          }),
          run: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    const feed = {
      id: "test-feed",
      airport_code: "ATL",
      checkpoint_id: null,
      type: "airport-web" as const,
      adapter: "airport-json" as const,
      url: "https://example.com",
      auth_config: { type: "none" as const },
      polling_interval_sec: 300,
      dynamic_mapping: null,
      status: "trial" as const,
      reliability_score: 0,
      discovered_by: "known-pattern" as const,
    };

    const result = await evaluateTrialFeed(feed, mockDb as unknown as D1Database);
    expect(result.action).toBe("activate");
  });
});
```

- [ ] **Step 2: Implement validator**

```typescript
// src/workers/discovery/validator.ts
import type { FeedConfig } from "@/lib/types/feed";
import { updateFeedStatus, updateFeedReliability, getTrialFeeds } from "@/lib/db/d1";
import { DISCOVERY_THRESHOLDS } from "@/lib/config/discovery.config";

interface EvaluationResult {
  feed_id: string;
  action: "activate" | "reject" | "continue";
  reliability_score: number;
  reason: string;
}

/** Check if a trial feed should be activated */
export function shouldActivate(
  reliabilityScore: number,
  successCount: number,
  errorCount: number
): boolean {
  const totalPolls = successCount + errorCount;
  // Need minimum 50 polls for meaningful evaluation
  if (totalPolls < 50) return false;
  return reliabilityScore >= DISCOVERY_THRESHOLDS.MIN_RELIABILITY_SCORE;
}

/** Evaluate a single trial feed */
export async function evaluateTrialFeed(
  feed: FeedConfig,
  db: D1Database
): Promise<EvaluationResult> {
  const stats = await db
    .prepare(
      `SELECT error_count_1h as error_count, success_count_1h as success_count,
              trial_start_at FROM feeds WHERE id = ?1`
    )
    .bind(feed.id)
    .first<{ error_count: number; success_count: number; trial_start_at: string }>();

  if (!stats) {
    return { feed_id: feed.id, action: "reject", reliability_score: 0, reason: "Feed not found" };
  }

  const totalPolls = stats.success_count + stats.error_count;
  const reliability = totalPolls > 0 ? stats.success_count / totalPolls : 0;

  // Check if trial period has elapsed (24h)
  const trialStart = stats.trial_start_at ? new Date(stats.trial_start_at).getTime() : 0;
  const trialHours = (Date.now() - trialStart) / 3600_000;

  if (trialHours < 24 && totalPolls < DISCOVERY_THRESHOLDS.TRIAL_POLL_COUNT) {
    return { feed_id: feed.id, action: "continue", reliability_score: reliability, reason: "Trial in progress" };
  }

  if (shouldActivate(reliability, stats.success_count, stats.error_count)) {
    await updateFeedStatus(db, feed.id, "active");
    await updateFeedReliability(db, feed.id, reliability);
    return { feed_id: feed.id, action: "activate", reliability_score: reliability, reason: "Reliable feed, activated" };
  }

  await updateFeedStatus(db, feed.id, "inactive");
  return { feed_id: feed.id, action: "reject", reliability_score: reliability, reason: `Low reliability: ${(reliability * 100).toFixed(1)}%` };
}

/** Evaluate all trial feeds */
export async function evaluateAllTrials(db: D1Database): Promise<EvaluationResult[]> {
  const trials = await getTrialFeeds(db);
  const results: EvaluationResult[] = [];

  for (const feed of trials) {
    const result = await evaluateTrialFeed(feed, db);
    results.push(result);
  }

  return results;
}
```

- [ ] **Step 3: Run tests, commit**

```bash
git add src/workers/discovery/validator.ts tests/workers/discovery/validator.test.ts
git commit -m "feat: add feed validator — 24h trial evaluation with auto-activate"
```

---

### Task 5: Health Monitor

**Files:**
- Create: `src/workers/health/monitor.ts`
- Test: `tests/workers/health/monitor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/health/monitor.test.ts
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
```

- [ ] **Step 2: Implement health monitor**

```typescript
// src/workers/health/monitor.ts
import { getActiveFeeds, getDegradedFeeds, updateFeedStatus, getFeedErrorRate } from "@/lib/db/d1";
import type { FeedConfig } from "@/lib/types/feed";

export interface HealthAssessment {
  status: "healthy" | "stale" | "degraded" | "failing";
  action: "none" | "flag" | "reduce-frequency" | "deactivate";
  reason: string;
}

interface FeedMetrics {
  errorCount: number;
  successCount: number;
  sameValueStreak: number;
  lastValue: number | null;
}

export function assessFeedHealth(metrics: FeedMetrics): HealthAssessment {
  const total = metrics.errorCount + metrics.successCount;
  const errorRate = total > 0 ? metrics.errorCount / total : 0;

  // Stale check: same value 10+ times in a row
  if (metrics.sameValueStreak >= 10) {
    return { status: "stale", action: "flag", reason: `Same value (${metrics.lastValue}) repeated ${metrics.sameValueStreak}x` };
  }

  // Error rate thresholds
  if (errorRate >= 0.5) {
    return { status: "failing", action: "deactivate", reason: `Error rate ${(errorRate * 100).toFixed(0)}% exceeds 50% threshold` };
  }

  if (errorRate >= 0.3) {
    return { status: "degraded", action: "reduce-frequency", reason: `Error rate ${(errorRate * 100).toFixed(0)}% exceeds 30% threshold` };
  }

  return { status: "healthy", action: "none", reason: "Feed operating normally" };
}

/** Run health check across all active feeds */
export async function runHealthCheck(db: D1Database): Promise<{
  checked: number;
  degraded: number;
  deactivated: number;
}> {
  const result = { checked: 0, degraded: 0, deactivated: 0 };
  const feeds = await getActiveFeeds(db);

  for (const feed of feeds) {
    result.checked++;
    const errorRate = await getFeedErrorRate(db, feed.id);

    const assessment = assessFeedHealth({
      errorCount: errorRate.error_count,
      successCount: errorRate.success_count,
      sameValueStreak: 0, // Would need additional tracking
      lastValue: null,
    });

    switch (assessment.action) {
      case "deactivate":
        await updateFeedStatus(db, feed.id, "inactive");
        result.deactivated++;
        break;
      case "reduce-frequency":
        await updateFeedStatus(db, feed.id, "degraded");
        result.degraded++;
        break;
    }
  }

  return result;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/workers/health/monitor.ts tests/workers/health/monitor.test.ts
git commit -m "feat: add feed health monitor — error rate assessment + auto-degrade"
```

---

### Task 6: Self-Heal Logic

**Files:**
- Create: `src/workers/health/self-heal.ts`
- Test: `tests/workers/health/self-heal.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/health/self-heal.test.ts
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
```

- [ ] **Step 2: Implement self-heal**

```typescript
// src/workers/health/self-heal.ts
import { getInactiveFeeds, updateFeedStatus } from "@/lib/db/d1";
import { getAdapter } from "@/lib/adapters/registry";
import type { FeedConfig } from "@/lib/types/feed";

const RETRY_INTERVAL_MS = 6 * 3600_000;  // 6 hours
const DORMANT_THRESHOLD_MS = 7 * 24 * 3600_000;  // 7 days
const DEAD_THRESHOLD_MS = 30 * 24 * 3600_000;  // 30 days

export function shouldRetry(status: string, lastErrorAt: string | null): boolean {
  if (status !== "inactive" && status !== "degraded") return false;
  if (!lastErrorAt) return true;
  const elapsed = Date.now() - new Date(lastErrorAt).getTime();
  return elapsed >= RETRY_INTERVAL_MS;
}

export function shouldMarkDormant(status: string, lastSuccessAt: string | null): boolean {
  if (status !== "inactive") return false;
  if (!lastSuccessAt) return true;
  const elapsed = Date.now() - new Date(lastSuccessAt).getTime();
  return elapsed >= DORMANT_THRESHOLD_MS;
}

export function shouldMarkDead(status: string, lastSuccessAt: string | null): boolean {
  if (status !== "dormant") return false;
  if (!lastSuccessAt) return true;
  const elapsed = Date.now() - new Date(lastSuccessAt).getTime();
  return elapsed >= DEAD_THRESHOLD_MS;
}

/** Run self-healing across all inactive/degraded feeds */
export async function runSelfHeal(
  db: D1Database,
  env: Record<string, unknown>
): Promise<{
  retried: number;
  reactivated: number;
  dormant: number;
  dead: number;
}> {
  const result = { retried: 0, reactivated: 0, dormant: 0, dead: 0 };
  const feeds = await getInactiveFeeds(db);

  for (const feed of feeds) {
    // Check for dormant/dead transitions
    if (shouldMarkDead(feed.status, null)) {
      await updateFeedStatus(db, feed.id, "dead");
      result.dead++;
      continue;
    }

    if (shouldMarkDormant(feed.status, null)) {
      await updateFeedStatus(db, feed.id, "dormant");
      result.dormant++;
      continue;
    }

    // Try to retry inactive feeds
    if (shouldRetry(feed.status, null)) {
      const adapter = getAdapter(feed.adapter);
      if (!adapter) continue;

      try {
        const health = await adapter.healthCheck(feed, env);
        result.retried++;

        if (health.is_healthy) {
          await updateFeedStatus(db, feed.id, "active");
          result.reactivated++;
        }
      } catch {
        // Retry failed, stay inactive
      }
    }
  }

  return result;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/workers/health/self-heal.ts tests/workers/health/self-heal.test.ts
git commit -m "feat: add self-heal logic — retry inactive feeds, dormant/dead transitions"
```

---

### Task 7: Wire Into Scheduled Worker

**Files:**
- Modify: `src/workers/scheduled.ts`

- [ ] **Step 1: Update scheduled.ts to wire in discovery + health**

Replace the existing scheduled.ts with:

```typescript
// src/workers/scheduled.ts
import { pollFeeds } from "./ingestion/poll-feeds";
import { runDiscoveryScan } from "./discovery/scanner";
import { evaluateAllTrials } from "./discovery/validator";
import { runHealthCheck } from "./health/monitor";
import { runSelfHeal } from "./health/self-heal";

export async function handleScheduled(
  event: ScheduledEvent,
  env: CloudflareEnv
): Promise<void> {
  const cron = event.cron;

  switch (cron) {
    case "* * * * *":
      // Every minute: poll feeds + health check
      await pollFeeds(env.DB, env.CACHE, env as unknown as Record<string, unknown>);
      await runHealthCheck(env.DB);
      break;

    case "*/5 * * * *":
      // Every 5 minutes: evaluate trial feeds + predictions (Plan 4)
      await evaluateAllTrials(env.DB);
      break;

    case "0 * * * *":
      // Every hour: maintenance + self-heal
      await hourlyMaintenance(env.DB);
      await runSelfHeal(env.DB, env as unknown as Record<string, unknown>);
      break;

    case "0 */6 * * *":
      // Every 6 hours: discovery scan
      await runDiscoveryScan(env.DB);
      break;

    default:
      console.log(`Unknown cron: ${cron}`);
  }
}

async function hourlyMaintenance(db: D1Database): Promise<void> {
  await db
    .prepare("UPDATE feeds SET error_count_1h = 0, success_count_1h = 0 WHERE status IN ('active', 'trial', 'degraded')")
    .run();

  // Roll up readings >6h old into hourly aggregates before pruning
  const rollupCutoff = new Date(Date.now() - 6 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
  await db
    .prepare(`
      INSERT OR REPLACE INTO readings_rollup (airport_code, checkpoint_id, lane_type, hour, avg_wait, min_wait, max_wait, sample_count, source_types)
      SELECT airport_code, checkpoint_id, lane_type,
        substr(measured_at, 1, 13) || ':00' as hour,
        ROUND(AVG(wait_minutes), 1), ROUND(MIN(wait_minutes), 1), ROUND(MAX(wait_minutes), 1),
        COUNT(*), GROUP_CONCAT(DISTINCT source_type)
      FROM readings
      WHERE measured_at < ?1 AND source_type != 'predicted'
      GROUP BY airport_code, checkpoint_id, lane_type, substr(measured_at, 1, 13)
    `)
    .bind(rollupCutoff)
    .run();

  // Prune raw readings older than 7 days (rollups are kept indefinitely)
  const deleteCutoff = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
  await db.prepare("DELETE FROM readings WHERE ingested_at < ?1").bind(deleteCutoff).run();

  const predCutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  await db.prepare("DELETE FROM predictions WHERE generated_at < ?1").bind(predCutoff).run();
}
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add src/workers/scheduled.ts
git commit -m "feat: wire discovery, validation, health, and self-heal into cron scheduler"
```
