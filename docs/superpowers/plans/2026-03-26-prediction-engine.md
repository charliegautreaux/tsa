# Prediction Engine Implementation Plan (Plan 4 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight prediction engine that estimates wait times for ~350 airports without live sensor feeds, using historical patterns, weather impact, FAA disruption status, and crowd corrections.

**Architecture:** Runs every 5 minutes via cron. Calculates a base wait from historical day/hour patterns, adjusts with weather and disruption multipliers, corrects with recent crowdsource data, then writes predictions to D1 and generates 4-hour forecasts.

**Tech Stack:** TypeScript, Cloudflare Workers (D1), vitest

---

## File Structure

```
src/
├── workers/
│   └── prediction/
│       ├── historical.ts       ← Historical day/hour pattern averages
│       ├── weather.ts          ← NOAA weather impact factor
│       ├── predictor.ts        ← Ensemble prediction engine
│       ├── forecast.ts         ← 4h forecast + best time window
│       └── run-predictions.ts  ← Orchestrator wired into cron
├── lib/
│   ├── types/
│   │   └── prediction.ts      ← Prediction types
│   └── db/
│       └── d1.ts              ← Add prediction query helpers (modify existing)
tests/
├── workers/
│   └── prediction/
│       ├── historical.test.ts
│       ├── weather.test.ts
│       ├── predictor.test.ts
│       └── forecast.test.ts
```

---

### Task 1: Prediction Types + DB Helpers

**Files:**
- Create: `src/lib/types/prediction.ts`
- Modify: `src/lib/db/d1.ts`

- [ ] **Step 1: Create prediction types**

```typescript
// src/lib/types/prediction.ts

export interface Prediction {
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  predicted_wait: number;
  confidence: number;
  trend: "rising" | "falling" | "stable";
  data_sources: string[];
  generated_at: string;
}

export interface ForecastPoint {
  time: string;
  predicted_wait: number;
  confidence: number;
}

export interface Forecast {
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  points: ForecastPoint[];
  best_time: {
    start: string;
    end: string;
    predicted_wait: number;
  } | null;
}

export interface HistoricalPattern {
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  day_of_week: number; // 0=Sun, 6=Sat
  hour: number;        // 0-23
  avg_wait: number;
  sample_count: number;
}

export interface WeatherImpact {
  airport_code: string;
  condition: string;
  impact_factor: number; // multiplier, 1.0 = no impact
  fetched_at: string;
}
```

- [ ] **Step 2: Add prediction DB helpers to d1.ts**

Append to existing `src/lib/db/d1.ts`:

```typescript
// ============================================================
// PREDICTIONS
// ============================================================

export async function upsertPrediction(db: D1Database, pred: {
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  forecast_time: string;
  predicted_wait: number;
  confidence: number;
}): Promise<void> {
  await db
    .prepare(`
      INSERT INTO predictions (airport_code, checkpoint_id, lane_type, forecast_time, predicted_wait, confidence)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(airport_code, checkpoint_id, lane_type, forecast_time) DO UPDATE SET
        predicted_wait = excluded.predicted_wait,
        confidence = excluded.confidence,
        generated_at = datetime('now')
    `)
    .bind(pred.airport_code, pred.checkpoint_id, pred.lane_type, pred.forecast_time, pred.predicted_wait, pred.confidence)
    .run();
}

export async function getPredictions(db: D1Database, airportCode: string): Promise<{
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  forecast_time: string;
  predicted_wait: number;
  confidence: number;
}[]> {
  const result = await db
    .prepare(`
      SELECT * FROM predictions
      WHERE airport_code = ?1 AND forecast_time > datetime('now')
      ORDER BY forecast_time ASC
    `)
    .bind(airportCode.toUpperCase())
    .all();
  return result.results as any[];
}

export async function getHistoricalAverages(db: D1Database, airportCode: string): Promise<{
  checkpoint_id: string;
  lane_type: string;
  day_of_week: number;
  hour: number;
  avg_wait: number;
  sample_count: number;
}[]> {
  const result = await db
    .prepare(`
      SELECT
        checkpoint_id,
        lane_type,
        CAST(strftime('%w', measured_at) AS INTEGER) as day_of_week,
        CAST(strftime('%H', measured_at) AS INTEGER) as hour,
        AVG(wait_minutes) as avg_wait,
        COUNT(*) as sample_count
      FROM readings
      WHERE airport_code = ?1 AND source_type != 'predicted'
      GROUP BY checkpoint_id, lane_type, day_of_week, hour
    `)
    .bind(airportCode.toUpperCase())
    .all();
  return result.results as any[];
}

export async function getRecentCrowdAverage(
  db: D1Database,
  airportCode: string,
  minutesBack: number = 30
): Promise<{ checkpoint: string; lane_type: string; avg_wait: number }[]> {
  const since = new Date(Date.now() - minutesBack * 60_000).toISOString();
  const result = await db
    .prepare(`
      SELECT checkpoint, lane_type, AVG(wait_minutes) as avg_wait
      FROM reports
      WHERE airport_code = ?1 AND created_at > ?2
      GROUP BY checkpoint, lane_type
    `)
    .bind(airportCode.toUpperCase(), since)
    .all();
  return result.results as any[];
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run
git add src/lib/types/prediction.ts src/lib/db/d1.ts
git commit -m "feat: add prediction types and DB query helpers"
```

---

### Task 2: Historical Pattern Calculator

**Files:**
- Create: `src/workers/prediction/historical.ts`
- Test: `tests/workers/prediction/historical.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/prediction/historical.test.ts
import { describe, it, expect } from "vitest";
import { getBaseWait, interpolateHour, DEFAULT_WAIT_MINUTES } from "@/workers/prediction/historical";
import type { HistoricalPattern } from "@/lib/types/prediction";

describe("getBaseWait", () => {
  const patterns: HistoricalPattern[] = [
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 8, avg_wait: 45, sample_count: 20 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 9, avg_wait: 55, sample_count: 18 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 14, avg_wait: 25, sample_count: 15 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "precheck", day_of_week: 1, hour: 8, avg_wait: 15, sample_count: 12 },
  ];

  it("returns exact match when available", () => {
    const result = getBaseWait(patterns, "atl-main", "standard", 1, 8);
    expect(result).toBe(45);
  });

  it("interpolates between hours", () => {
    const result = getBaseWait(patterns, "atl-main", "standard", 1, 8.5);
    expect(result).toBe(50); // midpoint of 45 and 55
  });

  it("returns default when no pattern found", () => {
    const result = getBaseWait(patterns, "atl-main", "standard", 3, 8);
    expect(result).toBe(DEFAULT_WAIT_MINUTES);
  });

  it("matches lane type correctly", () => {
    const result = getBaseWait(patterns, "atl-main", "precheck", 1, 8);
    expect(result).toBe(15);
  });
});

describe("interpolateHour", () => {
  it("returns exact value at whole hour", () => {
    expect(interpolateHour(45, 55, 0)).toBe(45);
  });

  it("returns midpoint at 0.5", () => {
    expect(interpolateHour(45, 55, 0.5)).toBe(50);
  });

  it("returns end value at 1.0", () => {
    expect(interpolateHour(45, 55, 1.0)).toBe(55);
  });
});
```

- [ ] **Step 2: Implement historical pattern calculator**

```typescript
// src/workers/prediction/historical.ts
import type { HistoricalPattern } from "@/lib/types/prediction";

export const DEFAULT_WAIT_MINUTES = 20;

/** Linearly interpolate between two values */
export function interpolateHour(startVal: number, endVal: number, fraction: number): number {
  return startVal + (endVal - startVal) * fraction;
}

/** Get base wait time from historical patterns */
export function getBaseWait(
  patterns: HistoricalPattern[],
  checkpointId: string,
  laneType: string,
  dayOfWeek: number,
  hour: number
): number {
  const floorHour = Math.floor(hour);
  const ceilHour = floorHour + 1;
  const fraction = hour - floorHour;

  const matching = patterns.filter(
    (p) => p.checkpoint_id === checkpointId && p.lane_type === laneType && p.day_of_week === dayOfWeek
  );

  if (matching.length === 0) return DEFAULT_WAIT_MINUTES;

  const floorMatch = matching.find((p) => p.hour === floorHour);
  const ceilMatch = matching.find((p) => p.hour === (ceilHour % 24));

  if (!floorMatch && !ceilMatch) return DEFAULT_WAIT_MINUTES;
  if (!floorMatch) return ceilMatch!.avg_wait;
  if (!ceilMatch || fraction === 0) return floorMatch.avg_wait;

  return interpolateHour(floorMatch.avg_wait, ceilMatch.avg_wait, fraction);
}

/** Apply day-of-week modifiers (weekends are typically lighter) */
export function getDayFactor(dayOfWeek: number): number {
  // Sunday=0, Monday=1, ... Saturday=6
  const factors: Record<number, number> = {
    0: 0.75,  // Sunday - lighter
    1: 1.1,   // Monday - heavy business travel
    2: 0.95,  // Tuesday
    3: 0.9,   // Wednesday
    4: 1.05,  // Thursday - heavy business travel
    5: 1.15,  // Friday - heaviest
    6: 0.8,   // Saturday - lighter
  };
  return factors[dayOfWeek] ?? 1.0;
}

/** Apply time-of-day modifiers for airports without enough historical data */
export function getHourFactor(hour: number): number {
  // Peak morning (5-9), peak afternoon (2-6), quiet overnight
  if (hour >= 5 && hour <= 8) return 1.3;
  if (hour >= 9 && hour <= 11) return 1.1;
  if (hour >= 12 && hour <= 13) return 0.9;
  if (hour >= 14 && hour <= 17) return 1.2;
  if (hour >= 18 && hour <= 20) return 1.0;
  return 0.6; // overnight
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/workers/prediction/historical.test.ts
npx vitest run
git add src/workers/prediction/historical.ts tests/workers/prediction/historical.test.ts
git commit -m "feat: add historical pattern calculator — base wait, day/hour factors"
```

---

### Task 3: Weather Impact Factor

**Files:**
- Create: `src/workers/prediction/weather.ts`
- Test: `tests/workers/prediction/weather.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/prediction/weather.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getWeatherImpact, conditionToFactor } from "@/workers/prediction/weather";

describe("conditionToFactor", () => {
  it("returns 1.0 for clear conditions", () => {
    expect(conditionToFactor("Clear")).toBe(1.0);
    expect(conditionToFactor("Few Clouds")).toBe(1.0);
  });

  it("returns higher factor for storms", () => {
    expect(conditionToFactor("Thunderstorm")).toBeGreaterThan(1.2);
  });

  it("returns moderate factor for rain", () => {
    const factor = conditionToFactor("Rain");
    expect(factor).toBeGreaterThan(1.0);
    expect(factor).toBeLessThan(1.3);
  });

  it("returns high factor for snow/ice", () => {
    expect(conditionToFactor("Snow")).toBeGreaterThan(1.3);
  });

  it("handles unknown conditions as neutral", () => {
    expect(conditionToFactor("Unknown")).toBe(1.0);
  });
});

describe("getWeatherImpact", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("fetches weather and returns impact factor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        properties: {
          textDescription: "Thunderstorm",
        },
      }),
    }));

    const result = await getWeatherImpact("ATL");
    expect(result.impact_factor).toBeGreaterThan(1.2);
    expect(result.condition).toBe("Thunderstorm");
  });

  it("returns neutral on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await getWeatherImpact("ATL");
    expect(result.impact_factor).toBe(1.0);
    expect(result.condition).toBe("unknown");
  });
});
```

- [ ] **Step 2: Implement weather impact**

```typescript
// src/workers/prediction/weather.ts
import type { WeatherImpact } from "@/lib/types/prediction";

const NOAA_OBS_BASE = "https://api.weather.gov/stations/K";

/** Map weather condition text to impact multiplier */
export function conditionToFactor(condition: string): number {
  const lower = condition.toLowerCase();

  // Severe weather — significant delays
  if (lower.includes("thunderstorm") || lower.includes("tornado")) return 1.4;
  if (lower.includes("blizzard") || lower.includes("ice storm")) return 1.5;

  // Winter weather — moderate-high delays
  if (lower.includes("snow") || lower.includes("freezing")) return 1.35;
  if (lower.includes("sleet") || lower.includes("ice")) return 1.3;

  // Rain/fog — moderate delays
  if (lower.includes("heavy rain")) return 1.2;
  if (lower.includes("rain") || lower.includes("drizzle")) return 1.1;
  if (lower.includes("fog") || lower.includes("mist")) return 1.15;

  // Wind
  if (lower.includes("wind")) return 1.1;

  // Clear/fair conditions — no impact
  if (lower.includes("clear") || lower.includes("sunny") || lower.includes("fair")) return 1.0;
  if (lower.includes("cloud") || lower.includes("overcast")) return 1.0;

  return 1.0; // unknown → neutral
}

/** Fetch current weather condition from NOAA for an airport */
export async function getWeatherImpact(airportCode: string): Promise<WeatherImpact> {
  try {
    const url = `${NOAA_OBS_BASE}${airportCode}/observations/latest`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "PreBoard.ai/1.0 (preboard.ai)",
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return { airport_code: airportCode, condition: "unknown", impact_factor: 1.0, fetched_at: new Date().toISOString() };
    }

    const data = await response.json() as { properties?: { textDescription?: string } };
    const condition = data?.properties?.textDescription ?? "unknown";

    return {
      airport_code: airportCode,
      condition,
      impact_factor: conditionToFactor(condition),
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return { airport_code: airportCode, condition: "unknown", impact_factor: 1.0, fetched_at: new Date().toISOString() };
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/workers/prediction/weather.test.ts
npx vitest run
git add src/workers/prediction/weather.ts tests/workers/prediction/weather.test.ts
git commit -m "feat: add weather impact factor — NOAA condition to wait time multiplier"
```

---

### Task 4: Ensemble Predictor

**Files:**
- Create: `src/workers/prediction/predictor.ts`
- Test: `tests/workers/prediction/predictor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/prediction/predictor.test.ts
import { describe, it, expect } from "vitest";
import { calculatePrediction, clampWait } from "@/workers/prediction/predictor";
import type { HistoricalPattern, WeatherImpact } from "@/lib/types/prediction";

describe("clampWait", () => {
  it("clamps negative values to 0", () => {
    expect(clampWait(-5)).toBe(0);
  });

  it("clamps high values to 180", () => {
    expect(clampWait(250)).toBe(180);
  });

  it("rounds to 1 decimal", () => {
    expect(clampWait(45.678)).toBe(45.7);
  });
});

describe("calculatePrediction", () => {
  const patterns: HistoricalPattern[] = [
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 8, avg_wait: 40, sample_count: 20 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 9, avg_wait: 50, sample_count: 18 },
  ];

  const weather: WeatherImpact = {
    airport_code: "ATL",
    condition: "Clear",
    impact_factor: 1.0,
    fetched_at: new Date().toISOString(),
  };

  it("produces prediction from historical + weather", () => {
    const result = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });
    expect(result.predicted_wait).toBeGreaterThan(30);
    expect(result.predicted_wait).toBeLessThan(60);
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("applies weather multiplier", () => {
    const stormWeather: WeatherImpact = { ...weather, condition: "Thunderstorm", impact_factor: 1.4 };

    const clear = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });

    const storm = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather: stormWeather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });

    expect(storm.predicted_wait).toBeGreaterThan(clear.predicted_wait);
  });

  it("incorporates crowd correction", () => {
    const withoutCrowd = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });

    const withCrowd = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: 60,
      hasDisruption: false,
    });

    expect(withCrowd.predicted_wait).toBeGreaterThan(withoutCrowd.predicted_wait);
  });

  it("applies disruption boost", () => {
    const normal = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: false,
    });

    const disrupted = calculatePrediction({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      dayOfWeek: 1,
      hour: 8,
      crowdAvg: null,
      hasDisruption: true,
    });

    expect(disrupted.predicted_wait).toBeGreaterThan(normal.predicted_wait);
  });
});
```

- [ ] **Step 2: Implement ensemble predictor**

```typescript
// src/workers/prediction/predictor.ts
import type { HistoricalPattern, WeatherImpact, Prediction } from "@/lib/types/prediction";
import { getBaseWait, getDayFactor, getHourFactor, DEFAULT_WAIT_MINUTES } from "./historical";

const MAX_WAIT = 180;
const CROWD_WEIGHT = 0.3; // How much crowd data corrects the prediction
const DISRUPTION_MULTIPLIER = 1.25;

/** Clamp wait time to valid range and round */
export function clampWait(wait: number): number {
  return Math.round(Math.max(0, Math.min(MAX_WAIT, wait)) * 10) / 10;
}

interface PredictionInput {
  checkpointId: string;
  laneType: string;
  patterns: HistoricalPattern[];
  weather: WeatherImpact;
  dayOfWeek: number;
  hour: number;
  crowdAvg: number | null;
  hasDisruption: boolean;
}

/** Calculate predicted wait from all available signals */
export function calculatePrediction(input: PredictionInput): {
  predicted_wait: number;
  confidence: number;
  data_sources: string[];
} {
  const dataSources: string[] = [];

  // 1. Historical base wait
  let baseWait = getBaseWait(input.patterns, input.checkpointId, input.laneType, input.dayOfWeek, Math.floor(input.hour));
  const hasHistory = baseWait !== DEFAULT_WAIT_MINUTES;
  if (hasHistory) {
    dataSources.push("historical");
  } else {
    // No history — use default with day/hour factors
    baseWait = DEFAULT_WAIT_MINUTES * getDayFactor(input.dayOfWeek) * getHourFactor(input.hour);
    dataSources.push("default-model");
  }

  // 2. Weather adjustment
  let wait = baseWait * input.weather.impact_factor;
  if (input.weather.impact_factor !== 1.0) {
    dataSources.push("weather");
  }

  // 3. Disruption adjustment
  if (input.hasDisruption) {
    wait *= DISRUPTION_MULTIPLIER;
    dataSources.push("faa-disruption");
  }

  // 4. Crowd correction — blend toward crowd average
  if (input.crowdAvg !== null) {
    wait = wait * (1 - CROWD_WEIGHT) + input.crowdAvg * CROWD_WEIGHT;
    dataSources.push("crowdsourced");
  }

  // Confidence based on data richness
  let confidence = 0.4; // base confidence for predictions
  if (hasHistory) confidence += 0.15;
  if (input.crowdAvg !== null) confidence += 0.1;
  if (input.weather.condition !== "unknown") confidence += 0.05;
  confidence = Math.min(0.65, confidence); // cap — predictions never as good as live

  return {
    predicted_wait: clampWait(wait),
    confidence: Math.round(confidence * 100) / 100,
    data_sources: dataSources,
  };
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/workers/prediction/predictor.test.ts
npx vitest run
git add src/workers/prediction/predictor.ts tests/workers/prediction/predictor.test.ts
git commit -m "feat: add ensemble predictor — historical + weather + disruption + crowd"
```

---

### Task 5: Forecast Generator

**Files:**
- Create: `src/workers/prediction/forecast.ts`
- Test: `tests/workers/prediction/forecast.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/workers/prediction/forecast.test.ts
import { describe, it, expect } from "vitest";
import { generateForecast, findBestTime } from "@/workers/prediction/forecast";
import type { HistoricalPattern, WeatherImpact, ForecastPoint } from "@/lib/types/prediction";

describe("generateForecast", () => {
  const patterns: HistoricalPattern[] = [
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 8, avg_wait: 45, sample_count: 20 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 9, avg_wait: 55, sample_count: 18 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 10, avg_wait: 40, sample_count: 15 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 11, avg_wait: 30, sample_count: 12 },
    { airport_code: "ATL", checkpoint_id: "atl-main", lane_type: "standard", day_of_week: 1, hour: 12, avg_wait: 25, sample_count: 10 },
  ];

  const weather: WeatherImpact = {
    airport_code: "ATL",
    condition: "Clear",
    impact_factor: 1.0,
    fetched_at: new Date().toISOString(),
  };

  it("generates 16 forecast points (4h × 15min intervals)", () => {
    const now = new Date("2026-03-26T08:00:00Z");
    const result = generateForecast({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      now,
      hasDisruption: false,
    });
    expect(result.length).toBe(16);
  });

  it("forecast points have increasing timestamps", () => {
    const now = new Date("2026-03-26T08:00:00Z");
    const result = generateForecast({
      checkpointId: "atl-main",
      laneType: "standard",
      patterns,
      weather,
      now,
      hasDisruption: false,
    });
    for (let i = 1; i < result.length; i++) {
      expect(new Date(result[i].time).getTime()).toBeGreaterThan(new Date(result[i - 1].time).getTime());
    }
  });
});

describe("findBestTime", () => {
  it("finds the lowest wait window", () => {
    const points: ForecastPoint[] = [
      { time: "2026-03-26T08:00:00Z", predicted_wait: 40, confidence: 0.5 },
      { time: "2026-03-26T08:15:00Z", predicted_wait: 45, confidence: 0.5 },
      { time: "2026-03-26T08:30:00Z", predicted_wait: 20, confidence: 0.5 },
      { time: "2026-03-26T08:45:00Z", predicted_wait: 15, confidence: 0.5 },
      { time: "2026-03-26T09:00:00Z", predicted_wait: 18, confidence: 0.5 },
      { time: "2026-03-26T09:15:00Z", predicted_wait: 35, confidence: 0.5 },
    ];

    const result = findBestTime(points);
    expect(result).not.toBeNull();
    expect(result!.predicted_wait).toBeLessThanOrEqual(20);
    expect(result!.start).toBe("2026-03-26T08:30:00Z");
  });

  it("returns null for empty forecast", () => {
    expect(findBestTime([])).toBeNull();
  });
});
```

- [ ] **Step 2: Implement forecast generator**

```typescript
// src/workers/prediction/forecast.ts
import type { HistoricalPattern, WeatherImpact, ForecastPoint } from "@/lib/types/prediction";
import { calculatePrediction, clampWait } from "./predictor";

const FORECAST_HOURS = 4;
const INTERVAL_MINUTES = 15;
const POINTS_COUNT = (FORECAST_HOURS * 60) / INTERVAL_MINUTES; // 16

interface ForecastInput {
  checkpointId: string;
  laneType: string;
  patterns: HistoricalPattern[];
  weather: WeatherImpact;
  now: Date;
  hasDisruption: boolean;
}

/** Generate 4-hour forecast in 15-minute intervals */
export function generateForecast(input: ForecastInput): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  const dayOfWeek = input.now.getUTCDay();

  for (let i = 0; i < POINTS_COUNT; i++) {
    const forecastTime = new Date(input.now.getTime() + i * INTERVAL_MINUTES * 60_000);
    const hour = forecastTime.getUTCHours() + forecastTime.getUTCMinutes() / 60;
    const forecastDay = forecastTime.getUTCDay();

    const result = calculatePrediction({
      checkpointId: input.checkpointId,
      laneType: input.laneType,
      patterns: input.patterns,
      weather: input.weather,
      dayOfWeek: forecastDay,
      hour,
      crowdAvg: null, // No crowd data for future predictions
      hasDisruption: input.hasDisruption,
    });

    // Confidence decays further into the future
    const decayFactor = 1 - (i / POINTS_COUNT) * 0.3; // up to 30% decay

    points.push({
      time: forecastTime.toISOString(),
      predicted_wait: result.predicted_wait,
      confidence: Math.round(result.confidence * decayFactor * 100) / 100,
    });
  }

  return points;
}

/** Find the best time window (lowest predicted wait) */
export function findBestTime(points: ForecastPoint[]): {
  start: string;
  end: string;
  predicted_wait: number;
} | null {
  if (points.length === 0) return null;

  let bestIdx = 0;
  let bestWait = points[0].predicted_wait;

  for (let i = 1; i < points.length; i++) {
    if (points[i].predicted_wait < bestWait) {
      bestWait = points[i].predicted_wait;
      bestIdx = i;
    }
  }

  // Extend the window to include adjacent similar-wait points
  let startIdx = bestIdx;
  let endIdx = bestIdx;
  const threshold = bestWait * 1.2; // within 20% of best

  while (startIdx > 0 && points[startIdx - 1].predicted_wait <= threshold) startIdx--;
  while (endIdx < points.length - 1 && points[endIdx + 1].predicted_wait <= threshold) endIdx++;

  return {
    start: points[startIdx].time,
    end: points[endIdx].time,
    predicted_wait: Math.round(bestWait * 10) / 10,
  };
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run tests/workers/prediction/forecast.test.ts
npx vitest run
git add src/workers/prediction/forecast.ts tests/workers/prediction/forecast.test.ts
git commit -m "feat: add forecast generator — 4h forecast in 15-min intervals + best time"
```

---

### Task 6: Prediction Orchestrator + Wire Into Cron

**Files:**
- Create: `src/workers/prediction/run-predictions.ts`
- Modify: `src/workers/scheduled.ts`

- [ ] **Step 1: Create the orchestrator**

```typescript
// src/workers/prediction/run-predictions.ts
import { getAllAirports, getHistoricalAverages, getRecentCrowdAverage, getCheckpoints, upsertPrediction, upsertCurrentWait } from "@/lib/db/d1";
import { getWeatherImpact } from "./weather";
import { calculatePrediction } from "./predictor";
import { generateForecast, findBestTime } from "./forecast";
import { calculateTrend } from "@/lib/utils/trend";
import type { HistoricalPattern } from "@/lib/types/prediction";

const LANE_TYPES = ["standard", "precheck", "clear"] as const;

export async function runPredictions(db: D1Database): Promise<{
  airports_processed: number;
  predictions_generated: number;
}> {
  const result = { airports_processed: 0, predictions_generated: 0 };
  const airports = await getAllAirports(db);
  const now = new Date();

  for (const airport of airports) {
    // Skip airports with live data (they don't need predictions)
    if (airport.data_tier === "live") continue;

    result.airports_processed++;

    const checkpoints = await getCheckpoints(db, airport.iata);
    if (checkpoints.length === 0) continue;

    const historicalRows = await getHistoricalAverages(db, airport.iata);
    const patterns: HistoricalPattern[] = historicalRows.map((r) => ({
      airport_code: airport.iata,
      checkpoint_id: r.checkpoint_id,
      lane_type: r.lane_type,
      day_of_week: r.day_of_week,
      hour: r.hour,
      avg_wait: r.avg_wait,
      sample_count: r.sample_count,
    }));

    const weather = await getWeatherImpact(airport.iata);

    const crowdAvgs = await getRecentCrowdAverage(db, airport.iata);
    const crowdMap = new Map(
      crowdAvgs.map((c) => [`${c.checkpoint}:${c.lane_type}`, c.avg_wait])
    );

    const dayOfWeek = now.getUTCDay();
    const hour = now.getUTCHours() + now.getUTCMinutes() / 60;

    for (const checkpoint of checkpoints) {
      for (const laneType of LANE_TYPES) {
        const crowdKey = `${checkpoint.id}:${laneType}`;
        const crowdAvg = crowdMap.get(crowdKey) ?? null;

        const pred = calculatePrediction({
          checkpointId: checkpoint.id,
          laneType,
          patterns,
          weather,
          dayOfWeek,
          hour,
          crowdAvg,
          hasDisruption: false,
        });

        // Current prediction
        await upsertCurrentWait(db, {
          airport_code: airport.iata,
          checkpoint_id: checkpoint.id,
          lane_type: laneType,
          wait_minutes: pred.predicted_wait,
          confidence: pred.confidence,
          trend: "stable",
          source_type: "predicted",
          data_tier: "predicted",
          updated_at: now.toISOString(),
        });

        // 4-hour forecast
        const forecastPoints = generateForecast({
          checkpointId: checkpoint.id,
          laneType,
          patterns,
          weather,
          now,
          hasDisruption: false,
        });

        for (const point of forecastPoints) {
          await upsertPrediction(db, {
            airport_code: airport.iata,
            checkpoint_id: checkpoint.id,
            lane_type: laneType,
            forecast_time: point.time,
            predicted_wait: point.predicted_wait,
            confidence: point.confidence,
          });
          result.predictions_generated++;
        }
      }
    }
  }

  return result;
}
```

- [ ] **Step 2: Update scheduled.ts to call runPredictions**

In `src/workers/scheduled.ts`, add the import and call in the `*/5 * * * *` case:

```typescript
import { runPredictions } from "./prediction/run-predictions";
```

Update the 5-minute case:
```typescript
    case "*/5 * * * *":
      // Every 5 minutes: evaluate trial feeds + run predictions
      await evaluateAllTrials(env.DB);
      await runPredictions(env.DB);
      break;
```

- [ ] **Step 3: Run all tests, commit**

```bash
npx vitest run
git add src/workers/prediction/run-predictions.ts src/workers/scheduled.ts
git commit -m "feat: add prediction orchestrator — historical + weather + crowd ensemble, 4h forecast"
```
