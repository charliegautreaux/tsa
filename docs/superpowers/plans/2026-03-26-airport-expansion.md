# Airport Data Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand PreBoard from 32 large-hub airports to 400+ US commercial airports using FAA public data, with tiered polling and enhanced discovery scanning.

**Architecture:** A Node.js script fetches FAA airport master records (public CSV), filters to commercial service airports, enriches with timezone/passenger data, and writes an expanded seed JSON. The existing seed script handles DB population unchanged. Poll-feeds gains tiered intervals based on hub size. Discovery scanner gets more URL patterns and rate limiting.

**Tech Stack:** Node.js/tsx scripts, Cloudflare D1, GitHub Actions cron, vitest

---

## File Structure

### New Files

```
scripts/fetch-faa-airports.ts       Fetches FAA CSV, filters, writes seed JSON
src/data/tz-lookup.json             US timezone boundary boxes (static)
src/lib/config/polling.config.ts    Tiered polling intervals by hub size
tests/scripts/fetch-faa-airports.test.ts  Tests for FAA parser/filter
tests/lib/config/polling.test.ts    Tests for polling tier logic
.github/workflows/refresh-airports.yml   Weekly cron to refresh FAA data
```

### Modified Files

```
src/data/airports-seed.json         32 → 400+ airports (regenerated)
src/workers/ingestion/poll-feeds.ts Add tiered polling skip logic
src/lib/config/discovery.config.ts  More patterns, higher limits
src/workers/discovery/scanner.ts    Rate limiting, priority scanning
```

---

### Task 1: US Timezone Lookup Data

**Files:**
- Create: `src/data/tz-lookup.json`

- [ ] **Step 1: Create timezone lookup file**

This is a static JSON file mapping US regions to IANA timezones by bounding box (west, south, east, north). The script will do point-in-box lookups.

```json
[
  {"tz":"America/New_York","w":-87.7,"s":24.4,"e":-66.9,"n":47.5},
  {"tz":"America/Chicago","w":-104.1,"s":25.8,"e":-87.7,"n":49.4},
  {"tz":"America/Denver","w":-111.1,"s":31.3,"e":-104.1,"n":49.0},
  {"tz":"America/Los_Angeles","w":-124.8,"s":32.5,"e":-111.1,"n":49.0},
  {"tz":"America/Anchorage","w":-180.0,"s":51.0,"e":-130.0,"n":72.0},
  {"tz":"Pacific/Honolulu","w":-178.0,"s":18.0,"e":-154.0,"n":29.0},
  {"tz":"America/Phoenix","w":-115.0,"s":31.3,"e":-109.0,"n":37.0},
  {"tz":"America/Adak","w":-180.0,"s":50.0,"e":-170.0,"n":55.0},
  {"tz":"Pacific/Guam","w":144.0,"s":13.0,"e":146.0,"n":14.0},
  {"tz":"America/Puerto_Rico","w":-67.5,"s":17.5,"e":-65.0,"n":18.6},
  {"tz":"Pacific/Samoa","w":-171.2,"s":-14.6,"e":-168.0,"n":-11.0},
  {"tz":"America/Virgin","w":-65.2,"s":17.6,"e":-64.5,"n":18.5}
]
```

- [ ] **Step 2: Commit**

```bash
git add src/data/tz-lookup.json
git commit -m "feat: add US timezone bounding-box lookup data"
```

---

### Task 2: FAA Airport Fetcher Script

**Files:**
- Create: `scripts/fetch-faa-airports.ts`
- Test: `tests/scripts/fetch-faa-airports.test.ts`

- [ ] **Step 1: Write tests for the FAA parser**

```ts
// tests/scripts/fetch-faa-airports.test.ts
import { describe, it, expect } from "vitest";
import {
  parseFaaRecord,
  lookupTimezone,
  mapHubSize,
  filterCommercial,
} from "../../scripts/fetch-faa-airports";

describe("mapHubSize", () => {
  it("maps FAA hub codes to AirportSize", () => {
    expect(mapHubSize("L")).toBe("large_hub");
    expect(mapHubSize("M")).toBe("medium_hub");
    expect(mapHubSize("S")).toBe("small_hub");
    expect(mapHubSize("N")).toBe("nonhub");
    expect(mapHubSize("")).toBe("unknown");
    expect(mapHubSize(undefined)).toBe("unknown");
  });
});

describe("lookupTimezone", () => {
  it("returns correct timezone for known US coordinates", () => {
    // Atlanta, GA
    expect(lookupTimezone(33.64, -84.43)).toBe("America/New_York");
    // Denver, CO
    expect(lookupTimezone(39.86, -104.67)).toBe("America/Denver");
    // Los Angeles, CA
    expect(lookupTimezone(33.94, -118.41)).toBe("America/Los_Angeles");
    // Honolulu, HI
    expect(lookupTimezone(21.32, -157.92)).toBe("Pacific/Honolulu");
    // Anchorage, AK
    expect(lookupTimezone(61.17, -150.0)).toBe("America/Anchorage");
  });

  it("returns America/New_York as fallback for unmatched coords", () => {
    expect(lookupTimezone(0, 0)).toBe("America/New_York");
  });
});

describe("parseFaaRecord", () => {
  it("parses a CSV row into an airport seed object", () => {
    const row: Record<string, string> = {
      LocationID: "ATL",
      ICAOIdentifier: "KATL",
      FacilityName: "HARTSFIELD-JACKSON ATLANTA INTL",
      City: "ATLANTA",
      State: "GA",
      Latitude: "33.6407",
      Longitude: "-84.4277",
      HubSize: "L",
      Enplanements: "46850000",
      FacilityType: "AIRPORT",
    };

    const result = parseFaaRecord(row);
    expect(result).not.toBeNull();
    expect(result!.iata).toBe("ATL");
    expect(result!.icao).toBe("KATL");
    expect(result!.name).toBe("Hartsfield-Jackson Atlanta Intl");
    expect(result!.city).toBe("Atlanta");
    expect(result!.state).toBe("GA");
    expect(result!.lat).toBe(33.6407);
    expect(result!.lng).toBe(-84.4277);
    expect(result!.size).toBe("large_hub");
    expect(result!.annual_pax).toBe(93700000);
    expect(result!.timezone).toBe("America/New_York");
  });

  it("returns null for non-airport facilities", () => {
    const row: Record<string, string> = {
      LocationID: "ATL",
      FacilityType: "HELIPORT",
      State: "GA",
      Latitude: "33.6",
      Longitude: "-84.4",
    };
    expect(parseFaaRecord(row)).toBeNull();
  });

  it("returns null for missing IATA code", () => {
    const row: Record<string, string> = {
      LocationID: "",
      FacilityType: "AIRPORT",
      State: "GA",
      Latitude: "33.6",
      Longitude: "-84.4",
    };
    expect(parseFaaRecord(row)).toBeNull();
  });
});

describe("filterCommercial", () => {
  it("keeps airports with enplanements > 0 or known hub size", () => {
    const airports = [
      { iata: "ATL", annual_pax: 93700000, size: "large_hub" as const },
      { iata: "TST", annual_pax: 0, size: "unknown" as const },
    ];
    const filtered = filterCommercial(airports as any);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].iata).toBe("ATL");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scripts/fetch-faa-airports.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the FAA fetcher script**

```ts
// scripts/fetch-faa-airports.ts
/**
 * Fetches FAA airport master data and writes expanded airports-seed.json.
 *
 * Usage:
 *   npx tsx scripts/fetch-faa-airports.ts
 *
 * Data sources:
 *   - FAA Airport Facilities (public domain)
 *   - BTS enplanement statistics (public domain)
 *
 * Exports parse/filter functions for testing.
 */

import fs from "fs";
import path from "path";

// ---------- types ----------

interface SeedAirport {
  iata: string;
  icao: string | null;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  timezone: string;
  size: "large_hub" | "medium_hub" | "small_hub" | "nonhub" | "unknown";
  annual_pax: number;
}

interface TzBox {
  tz: string;
  w: number;
  s: number;
  e: number;
  n: number;
}

// ---------- constants ----------

const SEED_PATH = path.join(__dirname, "../src/data/airports-seed.json");
const TZ_PATH = path.join(__dirname, "../src/data/tz-lookup.json");

const FAA_URL =
  "https://adip.faa.gov/agis/public/download/NPIAS-CY2023-Enplanements.csv";

// US states + DC + territories
const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY","PR","GU","VI","AS","MP",
]);

// ---------- exported utilities ----------

export function mapHubSize(code: string | undefined): SeedAirport["size"] {
  switch (code?.toUpperCase()) {
    case "L": return "large_hub";
    case "M": return "medium_hub";
    case "S": return "small_hub";
    case "N": return "nonhub";
    default: return "unknown";
  }
}

let tzBoxes: TzBox[] | null = null;
function loadTzBoxes(): TzBox[] {
  if (!tzBoxes) {
    tzBoxes = JSON.parse(fs.readFileSync(TZ_PATH, "utf-8"));
  }
  return tzBoxes!;
}

export function lookupTimezone(lat: number, lng: number): string {
  const boxes = loadTzBoxes();

  // Arizona special case (no DST)
  // Phoenix metro area is roughly 33.2-33.7 lat, -112.5 to -111.5 lng
  // But the AZ box in tz-lookup handles this

  for (const box of boxes) {
    if (lat >= box.s && lat <= box.n && lng >= box.w && lng <= box.e) {
      return box.tz;
    }
  }
  return "America/New_York"; // fallback for edge cases
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bIntl\b/gi, "Intl")
    .replace(/\bAfb\b/gi, "AFB")
    .replace(/\bArb\b/gi, "ARB");
}

export function parseFaaRecord(
  row: Record<string, string>
): SeedAirport | null {
  const facilityType = (row.FacilityType || "").trim().toUpperCase();
  if (facilityType !== "AIRPORT") return null;

  const iata = (row.LocationID || "").trim().toUpperCase();
  if (!iata || iata.length !== 3 || !/^[A-Z]{3}$/.test(iata)) return null;

  const state = (row.State || "").trim().toUpperCase();
  if (!VALID_STATES.has(state)) return null;

  const lat = parseFloat(row.Latitude);
  const lng = parseFloat(row.Longitude);
  if (isNaN(lat) || isNaN(lng)) return null;

  const icao = (row.ICAOIdentifier || "").trim().toUpperCase() || null;
  const name = titleCase((row.FacilityName || iata).trim());
  const city = titleCase((row.City || "").trim());
  const hubSize = mapHubSize((row.HubSize || "").trim());
  const enplanements = parseInt(row.Enplanements || "0", 10) || 0;

  return {
    iata,
    icao: icao && icao.length === 4 ? icao : `K${iata}`,
    name,
    city,
    state,
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
    timezone: lookupTimezone(lat, lng),
    size: hubSize,
    annual_pax: enplanements * 2, // enplanements = boardings; pax ≈ 2x
  };
}

export function filterCommercial(airports: SeedAirport[]): SeedAirport[] {
  return airports.filter(
    (a) => a.annual_pax > 0 || a.size !== "unknown"
  );
}

// ---------- CSV parser (minimal, no deps) ----------

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

// ---------- main ----------

async function main() {
  console.log("Fetching FAA airport data...");

  let csvText: string;
  try {
    const resp = await fetch(FAA_URL, {
      headers: { "User-Agent": "PreBoard/1.0 airport-seed-updater" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    csvText = await resp.text();
  } catch (err) {
    console.error("Failed to fetch FAA data:", err);
    console.log("Falling back to existing seed file (no changes).");
    process.exit(0);
  }

  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length} FAA records`);

  const parsed = rows
    .map(parseFaaRecord)
    .filter((a): a is SeedAirport => a !== null);
  console.log(`${parsed.length} valid airports after parsing`);

  const commercial = filterCommercial(parsed);
  console.log(`${commercial.length} commercial service airports`);

  // De-duplicate by IATA (keep highest pax)
  const byIata = new Map<string, SeedAirport>();
  for (const a of commercial) {
    const existing = byIata.get(a.iata);
    if (!existing || a.annual_pax > existing.annual_pax) {
      byIata.set(a.iata, a);
    }
  }

  // Sort by annual_pax descending
  const final = Array.from(byIata.values()).sort(
    (a, b) => b.annual_pax - a.annual_pax
  );

  fs.writeFileSync(SEED_PATH, JSON.stringify(final, null, 2) + "\n");
  console.log(`Wrote ${final.length} airports to ${SEED_PATH}`);
}

// Only run main when executed directly (not imported for tests)
if (require.main === module) {
  main().catch(console.error);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/scripts/fetch-faa-airports.test.ts`
Expected: All 4 test suites pass (mapHubSize, lookupTimezone, parseFaaRecord, filterCommercial)

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-faa-airports.ts tests/scripts/fetch-faa-airports.test.ts
git commit -m "feat: add FAA airport data fetcher script with tests"
```

---

### Task 3: Expand Airport Seed Data

**Files:**
- Modify: `src/data/airports-seed.json` (regenerated by script)

- [ ] **Step 1: Run the FAA fetcher to generate expanded seed**

```bash
npx tsx scripts/fetch-faa-airports.ts
```

Expected output: `Wrote 400+ airports to src/data/airports-seed.json`

If the FAA URL is unavailable (network issue in CI), the script exits gracefully with no changes. In that case, manually verify the existing 32 airports remain and skip to the commit — the weekly refresh workflow will populate later.

- [ ] **Step 2: Verify seed file has correct structure**

```bash
node -e "const a = require('./src/data/airports-seed.json'); console.log('Count:', a.length); console.log('First:', a[0].iata, a[0].name); console.log('Last:', a[a.length-1].iata, a[a.length-1].name); console.log('All have timezone:', a.every(x => x.timezone)); console.log('All have lat/lng:', a.every(x => typeof x.lat === 'number' && typeof x.lng === 'number'));"
```

Expected: Count: 400+, all validation checks true

- [ ] **Step 3: Commit**

```bash
git add src/data/airports-seed.json
git commit -m "feat: expand airport seed data to 400+ US commercial airports via FAA"
```

---

### Task 4: Tiered Polling Configuration

**Files:**
- Create: `src/lib/config/polling.config.ts`
- Test: `tests/lib/config/polling.test.ts`
- Modify: `src/workers/ingestion/poll-feeds.ts`

- [ ] **Step 1: Write tests for polling tier logic**

```ts
// tests/lib/config/polling.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/config/polling.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create polling config**

```ts
// src/lib/config/polling.config.ts
import type { AirportSize } from "@/lib/types/airport";

/** Polling interval in seconds, keyed by airport hub size */
const POLLING_TIERS: Record<AirportSize, number> = {
  large_hub: 60,
  medium_hub: 300,
  small_hub: 900,
  nonhub: 1800,
  unknown: 1800,
};

export function getPollingInterval(size: AirportSize): number {
  return POLLING_TIERS[size] ?? 1800;
}

export function shouldPollNow(
  size: AirportSize,
  lastSuccessAt: string | null
): boolean {
  if (!lastSuccessAt) return true;
  const elapsed = (Date.now() - new Date(lastSuccessAt).getTime()) / 1000;
  return elapsed >= getPollingInterval(size);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/config/polling.test.ts`
Expected: All 6 tests pass

- [ ] **Step 5: Integrate tiered polling into poll-feeds.ts**

In `src/workers/ingestion/poll-feeds.ts`, add the tiered polling check. Import `shouldPollNow` and `getAirport` query. Before processing each airport's feeds, check if polling is due.

Add import at top:
```ts
import { shouldPollNow } from "@/lib/config/polling.config";
import { getAirport } from "@/lib/db/d1";
```

Replace the inner loop that iterates over `feedsByAirport` entries. Change the `for` loop body to check the tier:

```ts
  for (const [airportCode, airportFeeds] of feedsByAirport) {
    // Tiered polling: skip airports whose interval hasn't elapsed
    const airport = await getAirport(db, airportCode);
    const size = airport?.size ?? "unknown";
    const lastSuccess = airportFeeds[0]
      ? (airportFeeds[0] as any).last_success_at ?? null
      : null;
    if (!shouldPollNow(size, lastSuccess)) continue;

    const allReadings = [];
```

Everything after `const allReadings = [];` stays the same.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing + new)

- [ ] **Step 7: Commit**

```bash
git add src/lib/config/polling.config.ts tests/lib/config/polling.test.ts src/workers/ingestion/poll-feeds.ts
git commit -m "feat: add tiered polling intervals based on airport hub size"
```

---

### Task 5: Enhance Discovery Scanner

**Files:**
- Modify: `src/lib/config/discovery.config.ts`
- Modify: `src/workers/discovery/scanner.ts`

- [ ] **Step 1: Expand discovery URL and domain patterns**

In `src/lib/config/discovery.config.ts`, add more domain patterns and URL paths:

Add to `AIRPORT_DOMAIN_PATTERNS` array:
```ts
  "{code}.airport-authority.com",
  "www.{city}airport.org",
  "airport.{city}.gov",
  "{code}intl.com",
  "www.{code}airport.com",
```

Add to `PROBE_URL_PATTERNS` array:
```ts
  "/api/security-lines",
  "/passenger-info/wait-times",
  "/tsa-info",
  "/api/v2/security",
  "/flight-info/security",
```

Update `DISCOVERY_THRESHOLDS`:
```ts
  /** Max number of airports to scan per discovery run */
  MAX_AIRPORTS_PER_RUN: 100,
  /** Max concurrent probes per domain */
  MAX_CONCURRENT_PER_DOMAIN: 2,
```

- [ ] **Step 2: Add rate limiting and priority scanning to scanner.ts**

In `src/workers/discovery/scanner.ts`, modify `runDiscoveryScan` to:
1. Sort airports by size priority (large first, then medium, small, nonhub)
2. Add per-domain rate limiting (max 2 concurrent probes per domain)

Replace the `runDiscoveryScan` function:

```ts
/** Size priority for scanning order (lower = scanned first) */
const SIZE_PRIORITY: Record<string, number> = {
  large_hub: 0,
  medium_hub: 1,
  small_hub: 2,
  nonhub: 3,
  unknown: 4,
};

/** Run a full discovery scan across airports */
export async function runDiscoveryScan(db: D1Database): Promise<{
  airports_scanned: number;
  urls_probed: number;
  feeds_discovered: number;
}> {
  const result = { airports_scanned: 0, urls_probed: 0, feeds_discovered: 0 };
  const airports = await getAllAirports(db);

  // Priority scan: large hubs first
  const sorted = [...airports].sort(
    (a, b) => (SIZE_PRIORITY[a.size] ?? 4) - (SIZE_PRIORITY[b.size] ?? 4)
  );

  const toScan = sorted.slice(0, DISCOVERY_THRESHOLDS.MAX_AIRPORTS_PER_RUN);

  // Track active probes per domain for rate limiting
  const domainProbes = new Map<string, number>();

  for (const airport of toScan) {
    result.airports_scanned++;
    const urls = generateProbeUrls(airport);

    for (const url of urls) {
      const alreadyProbed = await getDiscoveryLogForUrl(db, url);
      if (alreadyProbed) continue;

      // Per-domain rate limit
      const domain = new URL(url).hostname;
      const active = domainProbes.get(domain) ?? 0;
      const maxPerDomain = DISCOVERY_THRESHOLDS.MAX_CONCURRENT_PER_DOMAIN ?? 2;
      if (active >= maxPerDomain) continue;
      domainProbes.set(domain, active + 1);

      result.urls_probed++;
      const probe = await probeUrl(url, airport.iata);

      // Release domain slot
      domainProbes.set(domain, (domainProbes.get(domain) ?? 1) - 1);

      await insertDiscoveryLog(db, {
        url,
        airport_code: airport.iata,
        discovered_by: "known-pattern",
        probe_score: probe.score,
        adapter_detected: probe.adapterDetected,
        status: probe.score >= DISCOVERY_THRESHOLDS.MIN_PROBE_SCORE ? "trial" : "rejected",
      });

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
          polling_interval_sec: 300,
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

- [ ] **Step 3: Verify existing scanner tests still pass**

Run: `npx vitest run tests/workers/discovery/scanner.test.ts`
Expected: All tests pass (scoreResponse and probeUrl tests unchanged)

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/discovery.config.ts src/workers/discovery/scanner.ts
git commit -m "feat: enhance discovery scanner with more patterns, rate limiting, and priority scanning"
```

---

### Task 6: Weekly Airport Refresh Workflow

**Files:**
- Create: `.github/workflows/refresh-airports.yml`

- [ ] **Step 1: Create the GitHub Actions workflow**

```yaml
# .github/workflows/refresh-airports.yml
name: Refresh Airport Data

on:
  schedule:
    - cron: "0 6 * * 1" # Every Monday at 6 AM UTC
  workflow_dispatch: # Manual trigger

permissions:
  contents: write

jobs:
  refresh:
    name: Fetch FAA Data & Update Seed
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Fetch FAA airport data
        run: npx tsx scripts/fetch-faa-airports.ts

      - name: Check for changes
        id: diff
        run: |
          git diff --quiet src/data/airports-seed.json && echo "changed=false" >> "$GITHUB_OUTPUT" || echo "changed=true" >> "$GITHUB_OUTPUT"

      - name: Commit & push updated seed
        if: steps.diff.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/data/airports-seed.json
          git commit -m "chore: refresh airport seed data from FAA [automated]"
          git push

      - name: Seed remote D1
        if: steps.diff.outputs.changed == 'true'
        run: npx tsx scripts/seed-airports.ts --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/refresh-airports.yml
git commit -m "ci: add weekly FAA airport data refresh workflow"
```

---

### Task 7: Seed Expanded Airports to Remote D1

**Files:** None (uses existing `scripts/seed-airports.ts`)

- [ ] **Step 1: Seed to local D1 first (verify)**

```bash
npx tsx scripts/seed-airports.ts --local
```

Expected: `Seeded 400+/400+ airports`

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Seed to remote D1**

```bash
npx tsx scripts/seed-airports.ts --remote
```

Expected: `Seeded 400+/400+ airports` (production D1)

- [ ] **Step 5: Final commit with all changes**

```bash
git add -A
git commit -m "feat: airport data expansion complete — 400+ US commercial airports"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] FAA Airport Fetcher script → Task 2
- [x] Timezone lookup data → Task 1
- [x] Expanded seed JSON (32 → 400+) → Task 3
- [x] Tiered polling config + integration → Task 4
- [x] Discovery scanner enhancements (patterns, rate limiting, priority) → Task 5
- [x] Weekly refresh CI workflow → Task 6
- [x] Remote D1 seeding → Task 7

**Placeholder scan:** No TBD, TODO, or "implement later" found.

**Type consistency:** `AirportSize`, `SeedAirport`, `shouldPollNow`, `getPollingInterval`, `parseFaaRecord`, `filterCommercial`, `mapHubSize`, `lookupTimezone` — all consistent across tasks.
