# Airport Data Expansion — Design Spec

## Goal

Expand PreBoard from 32 large-hub airports to 400+ US commercial service airports using FAA public data as the authoritative source. Enhance the existing discovery scanner and polling infrastructure to scale efficiently across the expanded airport set.

## Current State

- **32 airports** in `src/data/airports-seed.json` (all large hubs)
- **11 data adapters** already registered (HTML, JSON, FAA SWIM, Bliptrack, etc.)
- **Autonomous discovery scanner** probes airports for wait time data sources
- **Cron polling** runs every 1-60 minutes
- **`upsertAirport()`** in D1 layer handles inserts/updates
- **Seed script** (`scripts/seed-airports.ts`) reads JSON and batch-inserts via wrangler CLI

## Architecture

### Data Source: FAA Airport Data

The FAA publishes airport master records through the **Aeronautical Data** portal. The BTS (Bureau of Transportation Statistics) publishes annual passenger enplanement data. Both are public domain government data — no API keys, no ToS restrictions, no scraping risk.

**Primary source**: FAA Airport Facilities Data (5050 records, CSV). Contains IATA, ICAO, name, city, state, lat/lng, facility type, hub classification.

**Enrichment source**: BTS T-100 enplanement statistics (annual passenger counts per airport).

**Approach**: Build a Node.js script that:
1. Fetches FAA airport master records (CSV)
2. Filters to commercial service airports (Part 139 certified, with scheduled service)
3. Enriches with BTS passenger data
4. Resolves IANA timezones from lat/lng using a lightweight lookup
5. Outputs the expanded `airports-seed.json`

### Data Flow

```
FAA CSV + BTS CSV
       ↓
  scripts/fetch-faa-airports.ts  (one-time + weekly refresh)
       ↓
  src/data/airports-seed.json    (400+ airports)
       ↓
  scripts/seed-airports.ts       (existing, unchanged)
       ↓
  D1 airports table              (upsert)
       ↓
  Discovery scanner probes new airports for wait time feeds
       ↓
  Poll-feeds cron picks up activated feeds
```

### Components

#### 1. FAA Airport Fetcher (`scripts/fetch-faa-airports.ts`)

**Purpose**: Fetch, filter, and merge FAA + BTS data into seed JSON.

**Inputs**:
- FAA Airport Facilities Data CSV (public, ~5000 rows)
- BTS enplanement data CSV (public, ~500 rows for commercial airports)
- Timezone lookup from lat/lng (using `src/data/tz-lookup.json` — a static mapping of US timezone boundaries)

**Filtering criteria**:
- `facility_type = 'AIRPORT'` (excludes heliports, seaplane bases)
- `Part 139 certified` OR `has scheduled commercial service`
- Has a valid IATA code (3-letter)
- Located in US states + DC + territories (PR, GU, VI, AS, MP)

**Output**: Overwrites `src/data/airports-seed.json` with the full set. Same schema as existing:
```json
{
  "iata": "ABQ",
  "icao": "KABQ",
  "name": "Albuquerque International Sunport",
  "city": "Albuquerque",
  "state": "NM",
  "lat": 35.0402,
  "lng": -106.6091,
  "timezone": "America/Denver",
  "size": "medium_hub",
  "annual_pax": 6200000
}
```

**Hub classification mapping** (FAA categories):
- `L` → `large_hub` (1%+ of national enplanements)
- `M` → `medium_hub` (0.25-1%)
- `S` → `small_hub` (0.05-0.25%)
- `N` → `nonhub` (<0.05%)

**Security**:
- Fetches only from `*.faa.gov` and `*.bts.gov` domains
- No authentication required
- No user data involved
- Script runs locally or in CI — never in the Worker runtime

#### 2. Timezone Lookup (`src/data/tz-lookup.json`)

**Purpose**: Map US lat/lng coordinates to IANA timezone strings without a heavy dependency.

**Approach**: A static JSON file containing US timezone boundary boxes. ~50 entries covering all US timezone regions. The fetcher script does a simple point-in-box lookup.

**Why not a library**: Keeps the project dependency-free for this concern. US timezones are stable and few enough to hardcode.

#### 3. Tiered Polling Configuration

**Purpose**: Prevent overwhelming D1 with 400+ airports polling every minute.

**Modification**: `src/lib/config/polling.config.ts` (new file)

```ts
export const POLLING_TIERS: Record<string, number> = {
  large_hub: 60,      // every 1 min (existing behavior)
  medium_hub: 300,    // every 5 min
  small_hub: 900,     // every 15 min
  nonhub: 1800,       // every 30 min
  unknown: 1800,      // default: every 30 min
};
```

**Integration**: `poll-feeds.ts` checks `airport.size` against `POLLING_TIERS` to determine if a feed should be polled in the current cycle. The cron still fires every minute — the poller skips feeds whose interval hasn't elapsed since `last_success_at`.

#### 4. Discovery Scanner Enhancements

**Modifications to**: `src/lib/config/discovery.config.ts` and `src/workers/discovery/scanner.ts`

**Changes**:
- Increase `MAX_AIRPORTS_PER_RUN` from 50 → 100 (still bounded)
- Add rate limiting: max 2 concurrent probes per domain to avoid looking like a DDoS
- Add more domain patterns: `{code}.airport-authority.com`, `www.{city}airport.org`, `airport.{city}.gov`
- Add more URL path patterns: `/api/security-lines`, `/passenger-info/wait-times`, `/tsa-info`
- **Priority scanning**: Scan large/medium hubs first, then small hubs, then non-hubs. Ensures the most valuable airports get discovered first.

#### 5. Seed Refresh Worker (`scripts/refresh-airports.ts`)

**Purpose**: Weekly cron in CI (GitHub Actions) that re-runs the FAA fetcher and commits updated seed data if changed.

**Flow**:
1. `fetch-faa-airports.ts` runs, downloads latest FAA data
2. Compares output to existing `airports-seed.json`
3. If changed: commits updated JSON, triggers deploy
4. If unchanged: no-op

**Why CI, not Worker**: The FAA data changes rarely (new airports, reclassifications). Running in GitHub Actions weekly keeps the Worker lean and avoids storing CSV parsing logic in the edge runtime.

## Files Changed/Created

### New Files
```
scripts/fetch-faa-airports.ts       FAA data fetcher + merger
src/data/tz-lookup.json             US timezone boundary lookup
src/lib/config/polling.config.ts    Tiered polling intervals
.github/workflows/refresh-airports.yml  Weekly refresh cron
```

### Modified Files
```
src/data/airports-seed.json         32 → 400+ airports
src/workers/ingestion/poll-feeds.ts Add tiered polling check
src/lib/config/discovery.config.ts  More patterns, higher limits
src/workers/discovery/scanner.ts    Rate limiting, priority scanning
scripts/seed-airports.ts            No changes (already handles any size)
```

## Security Considerations

- **Data sources**: Only government public domain data (FAA, BTS). No scraping of private sites.
- **No new secrets**: FAA data requires no API keys or authentication.
- **Rate limiting**: Discovery scanner enhanced with per-domain rate limits to prevent abuse complaints.
- **Input validation**: All FAA CSV data validated before writing to seed JSON (valid IATA codes, numeric lat/lng, known states).
- **No runtime fetching**: FAA data is fetched in CI/scripts only, never in the Worker. The Worker only reads the static seed JSON at deploy time.

## Scalability Considerations

- **Tiered polling** prevents D1 write amplification (400 airports × 1min = 400 writes/min → tiered = ~80 writes/min)
- **Discovery scanner** is already rate-limited and paginated; increasing to 100/run is safe
- **Seed script** already chunks in batches of 50 — handles 400+ airports without modification
- **D1 indexes** on `airports.state` and `airports.data_tier` already exist — no new indexes needed

## Out of Scope

- International airports (US only for now)
- Paid aviation APIs (FlightAware, OAG) — possible future enhancement
- Real-time airport metadata changes (handle via weekly refresh)
- Checkpoint seeding for new airports (discovery scanner + crowdsource handles this)
- New adapters (existing 11 are sufficient; discovery finds which ones work per airport)

## Success Criteria

1. `airports-seed.json` contains 400+ valid US commercial airports
2. All airports have correct IATA, ICAO, name, city, state, lat/lng, timezone, size, annual_pax
3. `seed-airports.ts` successfully seeds all airports to D1 (local and remote)
4. Polling respects tiered intervals — D1 writes don't spike 10x
5. Discovery scanner successfully finds new feeds for medium/small hub airports
6. Weekly refresh workflow runs without errors in CI
