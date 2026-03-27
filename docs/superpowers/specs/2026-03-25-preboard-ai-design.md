# PreBoard.ai — Design Specification

**Product**: PreBoard.ai — Real-time TSA security line visibility for every US airport
**Domain**: preboard.ai
**Tagline**: "Check PreBoard before you board."
**Date**: 2026-03-25
**Status**: Implemented and deployed
**Deployed at**: https://preboard.cgautreauxnc.workers.dev
**Repo**: https://github.com/charliegautreaux/tsa

---

## 1. Product Vision

PreBoard.ai is a real-time, map-first web application that shows TSA security wait times at every US commercial airport. Think FlightAware's Misery Map, but for the ground-side airport experience. The system autonomously discovers, validates, and integrates data feeds from airport sensors, government APIs, flight schedules, weather, and crowdsourced reports to deliver the most accurate wait time data available — independent of government infrastructure.

### Success Criteria

- Cover all ~400 US commercial airports on day 1 (prediction-based minimum)
- Live sensor data from 20+ major hubs at launch
- Sub-60-second data freshness for live-tier airports
- Sub-$50/month hosting cost
- 4.5+ star equivalent user satisfaction
- System autonomously discovers and adds new feeds without human intervention

---

## 2. Architecture

### 2.1 Stack (100% Cloudflare)

| Layer | Technology | Cloudflare Service | Cost |
|-------|-----------|-------------------|------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind 4 | **Workers** (via opennextjs-cloudflare) | $0-5/mo |
| API | REST route handlers (`/api/v1/*`) | **Workers** | (included) |
| Database | SQLite (9 tables: readings, airports, feeds, etc.) | **D1** (free: 5GB, 5M reads/day, 100K writes/day) | $0 |
| Cache | Current wait snapshot, map overview data | **KV** (free: 100K reads/day) | $0 |
| Cron Jobs | Feed polling, predictions, rollup, discovery | **Workers Scheduled** (free) | $0 |
| Build/Deploy | opennextjs-cloudflare + inject-cron.mjs | **GitHub Actions** | $0 |
| **Total** | **One account. One deploy. One bill.** | | **$0/mo (+ domain)** |

> **Implementation note (2026-03-26):** The stack runs on Cloudflare Workers via opennextjs-cloudflare, not Cloudflare Pages. Durable Objects are defined in source (`src/workers/durable-objects/airport-hub.ts`) but are **not currently deployed** -- the DO binding was removed from `wrangler.jsonc` to resolve CI build issues. R2 is not yet configured. WebSocket real-time push is not active. The map view (MapLibre GL + Protomaps) is not implemented; the homepage uses a server-rendered airport card grid instead.

### 2.2 System Diagram

```
External APIs                    Cloudflare Edge (Everything Here)
─────────────                    ─────────────────────────────────
                              ┌──────────────────────────────────────┐
Airport Sensor APIs ──────┐   │                                      │
  (BlipTrack, Xovis,      │   │  ┌────────────┐  ┌────────────────┐ │
   airport JSON feeds)     ├──→│  │ Cron Worker │  │ Cron Worker    │ │
                           │   │  │ (60s poll)  │  │ (60s poll)     │ │
FAA SWIM ─────────────────┤   │  │ Ingestion   │  │ Prediction     │ │
  (ground stops, delays)   │   │  │ Pipeline    │  │ Engine         │ │
                           │   │  └─────┬──────┘  └──────┬─────────┘ │
FlightAware AeroAPI ──────┤   │        │                 │           │
  (flight status, gates)   │   │        ▼                 ▼           │
                           │   │  ┌──────────────────────────────┐   │
NOAA / NWS ───────────────┤   │  │     Cloudflare D1 (SQLite)    │   │
  (weather, alerts)        │   │  │  - wait time readings         │   │
                           │   │  │  - predictions                │   │
TSA.gov ──────────────────┤   │  │  - airport/feed/checkpoint    │   │
  (daily throughput)       │   │  │    registries                 │   │
                           │   │  │  - crowdsourced reports       │   │
Crowdsourced Reports ─────┤   │  │  - user preferences           │   │
  (from users via API)     │   │  └──────────────┬───────────────┘   │
                           │   │                 │                    │
                           │   │  ┌──────────────▼───────────────┐   │
                           │   │  │    Cloudflare KV (Cache)      │   │
                           │   │  │  - current_waits snapshot     │   │
                           │   │  │  - map overview data          │   │
                           │   │  └──────────────┬───────────────┘   │
                           │   │                 │                    │
                           │   │  ┌──────────────▼───────────────┐   │
                           │   │  │    REST API Workers           │   │
                           │   │  │    /api/v1/*                  │   │
                           │   │  └──────────────┬───────────────┘   │
                           │   │                 │                    │
                           │   │  ┌──────────────▼───────────────┐   │
                           │   │  │  Durable Objects              │   │
                           │   │  │  (WebSocket hub per airport,  │   │
                           │   │  │   realtime push to clients)   │   │
                           │   │  └──────────────┬───────────────┘   │
                           │   │                 │                    │
                           │   │  ┌──────────────▼───────────────┐   │
                           │   │  │  Cloudflare Pages             │   │
                           │   │  │  Next.js 15 SSR + Static      │   │
                           │   │  └──────────────────────────────┘   │
                           │   │                                      │
                           │   │  ┌──────────────────────────────┐   │
                           │   │  │  Cloudflare R2               │   │
                           │   │  │  - Map tiles (Protomaps)     │   │
                           │   │  │  - Static seed data          │   │
                           │   │  └──────────────────────────────┘   │
                           │   └──────────────────────────────────────┘
```

> **Implementation note (2026-03-26):** The system diagram above reflects the original design. In the current deployment: Durable Objects are not active (no WebSocket push), Cloudflare Pages is replaced by Workers via opennextjs-cloudflare, and R2 is not configured. The map view is replaced by a server-rendered airport card grid.

### 2.3 Data Freshness Tiers

| Tier | Freshness | Source | Airports | UI Badge |
|------|-----------|--------|----------|----------|
| LIVE | <30 seconds | Airport sensor APIs | ~20 major hubs | Green pulsing "LIVE" |
| NEAR-LIVE | 1-2 minutes | Frequent API polling + crowdsourced + flight correlation | ~30 airports | Blue "~1 min ago" |
| PREDICTED | Updated every 60s | ML prediction from flights + historical + weather | ~350 airports | Orange "Predicted" |
| STALE | >10 minutes | Last known data, flagged prominently | Edge cases | Red "Last update: X min ago" |

---

## 3. Autonomous Feed System

The core differentiator: feeds are discovered, validated, activated, monitored, and recovered automatically. No human in the loop for standard operations.

### 3.1 Feed Lifecycle

```
DISCOVER → VALIDATE → ACTIVATE → MONITOR → RECOVER/KILL
    ↑                                          │
    └──────────────────────────────────────────┘
```

### 3.2 Discovery (runs every 6 hours)

Five autonomous discovery strategies:

1. **Known URL Patterns**: Probe ~400 airport domains against 20+ common URL patterns for wait time endpoints (e.g., `/{airport}.com/api/wait-times`, `/fly{airport}.com/security`).
2. **Sitemap/Robots Crawl**: Fetch sitemap.xml for every airport domain, look for endpoints containing wait/security/queue/checkpoint/tsa/screening keywords.
3. **FAA Registry Sync**: Pull latest FAA NPIAS airport list quarterly, diff against registry, auto-add new airports with "predicted-only" status, auto-remove decommissioned airports.
4. **Flight Schedule Inference**: Any airport with commercial departures in FlightAware automatically gets a prediction feed. Every commercial airport has coverage on day 1.
5. **Community Signal**: 5+ crowdsourced reports from an unknown airport → auto-create airport entry. Reports mentioning unknown checkpoint → auto-create checkpoint entry.

### 3.3 Validation (automatic, 24-hour trial)

When a new endpoint is discovered:

1. **Probe** (immediate): Hit endpoint, auto-detect adapter by trying every parser. Score response for wait-time-like data (numbers in 0-180 range, timestamps, airport identifiers, queue keywords). Proceed if score > 0.7.
2. **Trial** (24 hours): Poll every 5 minutes. Track uptime, response consistency, data variance. Compare against existing data for same airport. Score reliability.
3. **Adapter Auto-Detection**: Try each coded adapter. If none match but data is valid JSON, auto-generate a dynamic field mapping (JSONPath config, no code needed).
4. **Auto-activate** if reliability_score > 0.75 after 24 hours.

### 3.4 Dynamic Adapter Config

For feeds that don't match a coded adapter but return valid JSON:

```json
{
  "adapter": "dynamic-json",
  "mapping": {
    "wait_minutes": "$.data.checkpoints[*].waitTime",
    "checkpoint": "$.data.checkpoints[*].name",
    "lane_type": "$.data.checkpoints[*].laneType",
    "measured_at": "$.data.lastUpdated"
  }
}
```

No code deploy needed. Stored in D1 (`feeds.dynamic_mapping` column). Worker reads mapping at poll time.

### 3.5 Coded Adapters

```
src/lib/adapters/
├── base.ts              ← FeedAdapter interface
├── bliptrack.ts         ← BlipTrack/Veovo sensor protocol
├── xovis.ts             ← Xovis 3D sensor protocol
├── airport-json.ts      ← Generic JSON airport feed
├── airport-html.ts      ← HTML scrape (last resort)
├── dynamic-json.ts      ← Config-driven JSONPath mapper
├── faa-swim.ts          ← FAA SWIM data stream
├── flightaware.ts       ← FlightAware AeroAPI
├── noaa.ts              ← NOAA METAR/TAF weather
├── tsa-throughput.ts    ← TSA daily passenger data
├── traytable.ts         ← TrayTable wait-time data
└── crowdsource.ts       ← User-submitted reports
```

All adapters implement:

```typescript
interface FeedAdapter {
  id: string
  fetch(config: FeedConfig): Promise<RawReading[]>
  parse(raw: unknown): NormalizedReading[]
  validate(reading: NormalizedReading): boolean
  healthCheck(config: FeedConfig): Promise<FeedHealth>
}
```

All adapters output the same normalized shape:

```typescript
interface NormalizedReading {
  airport_code: string          // IATA code
  checkpoint: string            // "Main", "North", "T4", etc.
  lane_type: "standard" | "precheck" | "clear" | "unknown"
  wait_minutes: number
  confidence: number            // 0-1
  source_type: "sensor" | "airport-api" | "crowdsourced" | "predicted"
  measured_at: string           // ISO timestamp
  ingested_at: string           // ISO timestamp
}
```

### 3.6 Health Monitoring & Self-Heal (continuous)

Runs on every poll cycle (every 60 seconds):

- Track response time, error rate, data staleness per feed (rolling 1h window)
- Same value returned 10x in a row → flag stale
- Value jumps >3x historical average → verify against other sources before publishing
- Error rate > 30% for 1h → reduce poll frequency
- Error rate > 50% for 2h → deactivate feed
- Deactivated feed → retry every 6h
- Retry succeeds 3x → reactivate automatically
- Dead for 7 days → mark "dormant"
- Dead for 30 days → mark "dead", stop retrying
- All feeds for an airport die → auto-fallback to prediction-only
- Crowdsource volume spikes → weight crowd data higher (crisis mode)
- Data tier auto-adjusts based on active feed health

### 3.7 Data Fusion

When multiple feeds exist for the same checkpoint, priority order:

1. **Sensor data** (BlipTrack, Xovis) → confidence: 0.95
2. **Airport API** (official feed) → confidence: 0.85
3. **Crowdsourced** (user reports) → confidence: 0.70 (boosted to 0.80 with 3+ agreeing reports in 10 min)
4. **Predicted** (ML model) → confidence: 0.60

Fusion rules:
- Sensor data <2 min old → use it
- Sensor + crowd agree within 5 min → boost confidence to 0.98
- Sensor and crowd disagree → flag, use sensor
- Only crowd data → use if <10 min old + 2+ reports
- No live data → fall back to prediction
- Always tag output with source type and freshness

---

## 4. Prediction Engine

For airports without live sensor feeds (~350 airports), the prediction engine provides wait time estimates.

### 4.1 Model

```
Wait Time = Demand / Throughput Capacity

Demand = f(
  departing flights in next 3 hours,
  average load factor per flight,
  passenger arrival curves (when people show up relative to departure),
  day-of-week factor,
  seasonal factor,
  event factor (holidays, conventions, sports),
  disruption factor (delays → rebooking surges, cancellations → reduced demand)
)

Throughput = f(
  historical checkpoint throughput rate for this airport,
  lanes typically open at this day/time,
  staffing pattern proxy (derived from historical throughput),
  crisis factor (government shutdown → reduced capacity)
)

Real-time adjustment = f(
  flight delays and cancellations (FlightAware),
  weather disruptions (NOAA),
  FAA ground stops and delay programs (FAA SWIM),
  recent crowdsourced reports,
  Google busyness signal (relative)
)
```

### 4.2 Inputs

| Input | Source | Cost | Update Frequency |
|-------|--------|------|-----------------|
| Flight schedules + status | FlightAware AeroAPI | Free (1,000/mo) → $20-50/mo at scale | Every 60s |
| Ground stops, delay programs | FAA SWIM | Free | Real-time stream |
| Weather (METAR, TAF, SIGMETs) | NOAA Aviation Weather Service | Free | Every 60s |
| Severe weather alerts | NWS API | Free | Real-time |
| Daily passenger throughput | TSA.gov | Free | Daily batch |
| Historical flight performance | BTS On-Time Data | Free | Monthly batch |
| Crowdsourced reports | D1 (internal) | Free | Real-time |

### 4.3 Output

Updated every 60 seconds per airport:

```typescript
interface Prediction {
  airport_code: string
  checkpoint: string
  lane_type: "standard" | "precheck" | "clear"
  predicted_wait_minutes: number
  confidence: number              // 0-1
  trend: "rising" | "falling" | "stable"
  forecast_4h: {                  // next 4 hours, 15-min intervals
    time: string
    predicted_wait: number
    confidence: number
  }[]
  best_time: {                    // optimal window
    start: string
    end: string
    predicted_wait: number
  }
  data_sources: string[]          // which inputs contributed
}
```

---

## 5. API Design

### 5.1 REST API

Base URL: `https://preboard.cgautreauxnc.workers.dev/api/v1`

| Method | Endpoint | Description | Cache |
|--------|----------|-------------|-------|
| GET | `/airports` | All airports with current status | 60s |
| GET | `/airports/:code` | Single airport detail | 30s |
| GET | `/airports/:code/live` | Real-time snapshot (all checkpoints, all lanes) | 10s |
| GET | `/airports/:code/predict` | Prediction for next 4 hours | 60s |
| GET | `/airports/:code/history` | Dual-mode: `?hours=N` for raw, `?days=N` for rollup | 60s / 300s |
| GET | `/airports/:code/checkpoints` | Checkpoint definitions + current status | 30s |
| GET | `/map/overview` | All airports with current wait + tier | 30s |
| GET | `/map/worst` | Top 10 worst airports right now | 30s |
| GET | `/stats/national` | National summary stats | 60s |
| POST | `/reports` | Submit crowdsourced wait time report | - |
| GET | `/cron` | Internal cron trigger (auth-gated via `CRON_SECRET`) | - |
| GET | `/health` | System health + feed status summary | 10s |

> **Not implemented:** The WebSocket endpoint (`/ws/live`) from the original design requires Durable Objects, which are not currently deployed.

### 5.2 WebSocket Protocol (Not Yet Implemented)

```
Client → Server:
  { "type": "subscribe", "airports": ["ATL", "ORD", "LAX"] }
  { "type": "unsubscribe", "airports": ["LAX"] }

Server → Client:
  { "type": "update", "airport": "ATL", "checkpoint": "Main",
    "standard": { "wait": 92, "trend": "rising" },
    "precheck": { "wait": 38, "trend": "rising" },
    "clear": { "wait": 8, "trend": "stable" },
    "tier": "live", "updated_at": "2026-03-25T14:30:15Z" }
  { "type": "alert", "airport": "ATL",
    "message": "Wait times exceeding 90 minutes at Main checkpoint" }
  { "type": "heartbeat", "ts": "2026-03-25T14:30:30Z" }
```

### 5.3 Response Shape Example

`GET /api/v1/airports/ATL/live`

```json
{
  "airport": {
    "code": "ATL",
    "name": "Hartsfield-Jackson Atlanta International",
    "city": "Atlanta",
    "state": "GA",
    "data_tier": "live"
  },
  "checkpoints": [
    {
      "id": "atl-main",
      "name": "Main Checkpoint",
      "terminal": "Domestic",
      "status": "open",
      "lanes": {
        "standard": {
          "wait_minutes": 92,
          "trend": "rising",
          "confidence": 0.95,
          "source": "sensor"
        },
        "precheck": {
          "wait_minutes": 38,
          "trend": "rising",
          "confidence": 0.95,
          "source": "sensor"
        },
        "clear": {
          "wait_minutes": 8,
          "trend": "stable",
          "confidence": 0.85,
          "source": "airport-api"
        }
      },
      "updated_at": "2026-03-25T14:30:15Z"
    },
    {
      "id": "atl-south",
      "name": "South Checkpoint",
      "terminal": "Domestic",
      "status": "open",
      "lanes": { ... },
      "updated_at": "2026-03-25T14:30:42Z"
    },
    {
      "id": "atl-north",
      "name": "North Checkpoint",
      "terminal": "Domestic",
      "status": "closed",
      "reopens_at": "2026-03-26T04:00:00Z"
    }
  ],
  "flight_status": {
    "total_departures": 312,
    "on_time_pct": 78,
    "delayed_pct": 18,
    "cancelled_pct": 4,
    "ground_stops": false
  },
  "weather": {
    "condition": "Clear",
    "temp_f": 72,
    "impact": "none"
  },
  "meta": {
    "data_tier": "live",
    "sources_active": 3,
    "last_sensor_reading": "2026-03-25T14:30:15Z",
    "last_prediction_update": "2026-03-25T14:30:00Z"
  }
}
```

---

## 6. Database Schema

### 6.1 Cloudflare D1 (All Data — Single Database)

```sql
-- Airport registry (seeded from FAA NPIAS, auto-extended)
CREATE TABLE airports (
  iata TEXT PRIMARY KEY,
  icao TEXT,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  timezone TEXT NOT NULL,
  size TEXT,                     -- large_hub, medium_hub, small_hub, nonhub
  annual_pax INTEGER,
  data_tier TEXT DEFAULT 'predicted',  -- live, near-live, predicted
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Checkpoint definitions (auto-discovered from feeds + crowd)
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,           -- e.g., "atl-main"
  airport_code TEXT NOT NULL REFERENCES airports(iata),
  name TEXT NOT NULL,            -- e.g., "Main Checkpoint"
  terminal TEXT,
  has_standard INTEGER DEFAULT 1,
  has_precheck INTEGER DEFAULT 1,
  has_clear INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',    -- open, closed, unknown
  reopens_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Feed registry (autonomous lifecycle)
CREATE TABLE feeds (
  id TEXT PRIMARY KEY,           -- e.g., "atl-bliptrack-main"
  airport_code TEXT NOT NULL REFERENCES airports(iata),
  checkpoint_id TEXT REFERENCES checkpoints(id),
  type TEXT NOT NULL,            -- sensor-api, airport-web, government, flight-data, crowdsourced, derived
  adapter TEXT NOT NULL,         -- bliptrack, xovis, airport-json, dynamic-json, etc.
  url TEXT,
  auth_config TEXT,              -- JSON: { type: "none" | "api-key" | "bearer", ... }
  polling_interval_sec INTEGER DEFAULT 60,
  dynamic_mapping TEXT,          -- JSON: JSONPath mapping for dynamic-json adapter
  status TEXT DEFAULT 'pending', -- pending, trial, active, degraded, inactive, dormant, dead
  reliability_score REAL DEFAULT 0,
  last_success_at TEXT,
  last_error_at TEXT,
  last_error TEXT,
  error_count_1h INTEGER DEFAULT 0,
  success_count_1h INTEGER DEFAULT 0,
  trial_start_at TEXT,
  activated_at TEXT,
  discovered_by TEXT,            -- known-pattern, sitemap-crawl, faa-sync, community, manual
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Wait time readings (time-series, main data table)
CREATE TABLE readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airport_code TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  lane_type TEXT NOT NULL,       -- standard, precheck, clear, unknown
  wait_minutes REAL NOT NULL,
  confidence REAL NOT NULL,
  source_type TEXT NOT NULL,     -- sensor, airport-api, crowdsourced, predicted
  feed_id TEXT,
  measured_at TEXT NOT NULL,
  ingested_at TEXT DEFAULT (datetime('now'))
);

-- Index for fast queries
CREATE INDEX idx_readings_airport_time ON readings(airport_code, measured_at DESC);
CREATE INDEX idx_readings_checkpoint_time ON readings(checkpoint_id, measured_at DESC);

-- Current snapshot (materialized view, updated every poll cycle)
CREATE TABLE current_waits (
  airport_code TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  lane_type TEXT NOT NULL,
  wait_minutes REAL NOT NULL,
  confidence REAL NOT NULL,
  trend TEXT,                    -- rising, falling, stable
  source_type TEXT NOT NULL,
  data_tier TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (airport_code, checkpoint_id, lane_type)
);

-- Predictions (updated every 60 seconds)
CREATE TABLE predictions (
  airport_code TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  lane_type TEXT NOT NULL,
  forecast_time TEXT NOT NULL,   -- the future time being predicted
  predicted_wait REAL NOT NULL,
  confidence REAL NOT NULL,
  generated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (airport_code, checkpoint_id, lane_type, forecast_time)
);

-- Feed discovery log (what the scanner found)
CREATE TABLE discovery_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  airport_code TEXT,
  discovered_by TEXT NOT NULL,
  probe_score REAL,
  adapter_detected TEXT,
  status TEXT DEFAULT 'discovered',  -- discovered, probing, trial, activated, rejected
  created_at TEXT DEFAULT (datetime('now'))
);

-- Hourly rollup table for long-term trend analysis
-- Raw readings kept 7 days; rollups kept indefinitely
CREATE TABLE readings_rollup (
  airport_code TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  lane_type TEXT NOT NULL,
  hour TEXT NOT NULL,           -- 'YYYY-MM-DD HH:00' (UTC)
  avg_wait REAL NOT NULL,
  min_wait REAL NOT NULL,
  max_wait REAL NOT NULL,
  sample_count INTEGER NOT NULL,
  source_types TEXT NOT NULL,   -- comma-separated distinct sources
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (airport_code, checkpoint_id, lane_type, hour)
);

-- Data retention strategy:
-- Raw readings (per-minute): kept 7 days in `readings` table
-- Hourly rollups: kept indefinitely in `readings_rollup` table
-- Every hour, readings >6h old are aggregated into rollups before raw data ages out
-- Predictions older than 24 hours are pruned
```

### 6.2 User Data (Also in D1)

```sql
-- User-submitted wait time reports
CREATE TABLE reports (
  id TEXT PRIMARY KEY,            -- nanoid or uuid string
  airport_code TEXT NOT NULL,
  checkpoint TEXT NOT NULL,
  lane_type TEXT NOT NULL,        -- standard, precheck, clear
  wait_minutes INTEGER NOT NULL,
  note TEXT,
  lat REAL,                       -- GPS for airport auto-detection
  lng REAL,
  ip_hash TEXT,                   -- for spam prevention, not tracking
  created_at TEXT DEFAULT (datetime('now'))
);

-- User preferences (stored in localStorage for V1, D1 for future auth)
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,            -- anonymous session id or future user id
  saved_airports TEXT,            -- JSON array of IATA codes
  default_airport TEXT,
  notifications_enabled INTEGER DEFAULT 0,
  notification_threshold INTEGER DEFAULT 60,
  theme TEXT DEFAULT 'system',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Rate limiting for reports (prevent spam)
CREATE TABLE report_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  report_count INTEGER DEFAULT 0,
  window_start TEXT DEFAULT (datetime('now'))
);
```

---

## 7. UI Design

### 7.1 Views (Implemented)

**Home / Airport Grid** (`/`)
- Server-rendered grid of airport cards with national stats summary
- Four stat cards: airports monitored, average wait, live feeds, alerts
- Airport cards: glass morphism design with severity-colored glow borders
- Each card shows IATA code, airport name, current wait, data tier badge, sparkline trend
- Search and sort functionality on the grid
- Stagger entrance animation on page load

**Airport Detail** (`/airports/[code]`)
- Airport header with data tier badge
- Checkpoint rows showing wait times per lane type
- Historical data visualization

**Crowdsource Report** (via `POST /api/v1/reports`)
- API-only endpoint for report submission (no dedicated UI page yet)

### 7.1b Views (Designed but Not Yet Implemented)

- **Misery Map**: Full-viewport MapLibre GL map with color-coded airport dots (requires R2 for tiles)
- **Report page** (`/report`): GPS-enabled wait time submission form
- **Admin dashboard** (`/admin`): Feed management, discovery log, system health
- **WebSocket real-time push** (`/ws/live`): Requires Durable Objects

### 7.1c Dark Mode UI Design (Implemented)

The application defaults to dark mode via `next-themes` with the following design system:

**Glass morphism card system** (`.glass` CSS class):
- Light mode: White background, subtle shadow, hover lift
- Dark mode: `rgba(255, 255, 255, 0.03)` background, `backdrop-filter: blur(20px) saturate(1.2)`, inset highlight border, deep shadow

**Atmospheric background** (`.mesh-bg`):
- Three overlapping radial gradients: purple at top-left, blue at top-right, purple at bottom-center
- Creates a subtle depth without distracting from content

**Severity glow system** (`.glow-green`, `.glow-yellow`, `.glow-orange`, `.glow-red`):
- Cards glow with the wait-time severity color (green/yellow/orange/red)
- Glow intensifies on hover
- Applied via `box-shadow` with color-matched rgba values

**Gradient text** (`.gradient-text`):
- Heading text: white to slate-400 vertical gradient in dark mode

**Stagger animations** (`.stagger`):
- Cards animate in sequentially with 40ms delays between each
- `cubic-bezier(0.16, 1, 0.3, 1)` easing for smooth deceleration

**Live pulse** (`glow-pulse` keyframe):
- Pulsing opacity animation for live-data indicators

### 7.2 Design System

| Element | Choice | Status |
|---------|--------|--------|
| CSS framework | Tailwind CSS 4 | Implemented |
| Theme | next-themes (default: dark, system detection enabled) | Implemented |
| Font | Inter (body) + JetBrains Mono (data) via CSS custom properties | Implemented |
| Icons | Lucide React | Implemented |
| Styling | Custom glass morphism + severity glow system (no component library) | Implemented |
| Animations | CSS keyframes (stagger entrance, glow pulse) | Implemented |
| Component library | shadcn/ui | Not yet added (using custom components) |
| Map library | MapLibre GL JS + Protomaps | Not yet implemented |
| Charts | Recharts | Not yet added (sparklines are custom SVG) |
| Search | cmdk | Not yet added (custom search implementation) |

### 7.3 Color Scale (Wait Times)

Defined as Tailwind CSS custom properties in `globals.css`:

| Range | Color | CSS Property | Hex |
|-------|-------|-------------|-----|
| 0-15 min | Green (low) | `--color-wait-low` | #22c55e |
| 15-30 min | Yellow (moderate) | `--color-wait-moderate` | #eab308 |
| 30-60 min | Orange (high) | `--color-wait-high` | #f97316 |
| 60+ min | Red (severe) | `--color-wait-severe` | #ef4444 |

In dark mode, Tailwind's built-in dark variants are used (e.g., `text-green-400` for dark, `text-green-600` for light).

### 7.4 Responsive Breakpoints

- **Desktop** (1024px+): Full map with sidebar for worst airports. Airport detail: 2-column layout.
- **Tablet** (768-1024px): Full map, overlay cards on tap. Airport detail: stacked single column.
- **Mobile** (<768px): Map fills viewport, bottom sheet for airport list. Tap airport → bottom sheet expands to full detail. Report: fullscreen flow with big tap targets. GPS auto-detects "Your Airport" on load.

---

## 8. Project Structure (Current Implementation)

```
src/
├── app/                              Next.js App Router
│   ├── page.tsx                      Homepage (airport grid with stats)
│   ├── layout.tsx                    Root layout (dark mode, ThemeProvider, nav, footer)
│   ├── globals.css                   Dark mode glass morphism + animation styles
│   ├── airports/[code]/
│   │   └── page.tsx                  Airport detail page
│   └── api/v1/                       REST API route handlers
│       ├── airports/route.ts         GET /airports
│       ├── airports/[code]/route.ts  GET /airports/:code
│       ├── airports/[code]/live/     GET /airports/:code/live
│       ├── airports/[code]/predict/  GET /airports/:code/predict
│       ├── airports/[code]/history/  GET /airports/:code/history (dual-mode)
│       ├── airports/[code]/checkpoints/  GET /airports/:code/checkpoints
│       ├── cron/route.ts             Internal cron trigger endpoint
│       ├── health/route.ts           System health check
│       ├── map/overview/route.ts     Map overview data
│       ├── map/worst/route.ts        Worst airports
│       ├── reports/route.ts          POST crowdsource reports
│       └── stats/national/route.ts   National statistics
│
├── workers/                          Background processing
│   ├── scheduled.ts                  Cron entry point (routes triggers + hourly rollup)
│   ├── ingestion/
│   │   ├── poll-feeds.ts             Main polling orchestrator
│   │   ├── process-reading.ts        Normalize + validate + store
│   │   └── fusion.ts                 Multi-source data fusion
│   ├── prediction/
│   │   └── run-predictions.ts        ML prediction engine
│   ├── discovery/
│   │   ├── scanner.ts                Probe airports for new feeds
│   │   └── validator.ts              Trial feed evaluation
│   ├── health/
│   │   ├── monitor.ts                Feed health tracking
│   │   └── self-heal.ts              Auto-recovery logic
│   └── durable-objects/
│       └── airport-hub.ts            WebSocket hub (NOT currently deployed)
│
├── lib/                              Shared libraries
│   ├── adapters/                     13 feed adapters
│   │   ├── base.ts                   FeedAdapter interface
│   │   ├── registry.ts               Adapter lookup
│   │   ├── bliptrack.ts              BlipTrack/Veovo sensors
│   │   ├── xovis.ts                  Xovis 3D sensors
│   │   ├── airport-json.ts           Generic JSON feeds
│   │   ├── airport-html.ts           HTML scraping
│   │   ├── dynamic-json.ts           Config-driven JSONPath mapper
│   │   ├── faa-swim.ts               FAA SWIM stream
│   │   ├── flightaware.ts            FlightAware AeroAPI
│   │   ├── noaa.ts                   NOAA weather
│   │   ├── tsa-throughput.ts         TSA passenger data
│   │   ├── traytable.ts              TrayTable data
│   │   └── crowdsource.ts            User reports
│   ├── db/
│   │   ├── d1.ts                     D1 queries
│   │   └── kv.ts                     KV cache helpers
│   ├── types/
│   │   └── feed.ts                   Feed, adapter, discovery types
│   └── utils/                        Trend, validation, color utilities
│
├── components/                       React components
│   ├── airport/
│   │   ├── airport-card.tsx          Airport card (glass morphism + glow)
│   │   └── checkpoint-row.tsx        Checkpoint detail row
│   ├── layout/
│   │   ├── top-nav.tsx               Navigation bar
│   │   └── footer.tsx                Page footer
│   ├── search/                       Search components
│   └── shared/
│       ├── data-tier-badge.tsx        LIVE / NEAR-LIVE / PREDICTED badge
│       ├── wait-badge.tsx             Wait time display with severity color
│       └── sparkline.tsx              Inline sparkline chart

migrations/
├── 0001_initial_schema.sql            Core tables (airports, checkpoints, feeds, readings, etc.)
└── 0002_readings_rollup.sql           Hourly rollup table

scripts/
├── inject-cron.mjs                    Post-build cron handler injection
├── seed-airports.ts                   Airport registry seeder
└── seed-dev-data.ts                   Development data seeder

tests/
└── api/health.test.ts                 Health endpoint test

.github/workflows/deploy.yml           CI/CD pipeline
wrangler.jsonc                         Cloudflare bindings and cron config
```

---

## 9. Hosting & Deployment

### 9.1 Infrastructure (Current Deployment)

| Cloudflare Service | Purpose | Status |
|-------------------|---------|--------|
| Workers | Next.js SSR + API + cron (via opennextjs-cloudflare) | Active |
| D1 | All data (readings, airports, feeds, reports) | Active (`preboard-db`) |
| KV | Cache layer (current_waits, map overview) | Active (`CACHE`) |
| Workers Scheduled | Cron triggers (1min, 5min, hourly, 6-hourly) | Active |
| Durable Objects | WebSocket pub/sub hubs | **Not deployed** (binding removed from wrangler.jsonc) |
| R2 | Map tiles, static assets | **Not configured** |

### 9.2 Deployment Pipeline (GitHub Actions)

The CI/CD pipeline runs via `.github/workflows/deploy.yml`:

1. Push to `main` triggers the workflow (also supports `workflow_dispatch`)
2. A concurrency group (`deploy-production`) prevents overlapping deploys
3. Steps:
   - Checkout + Setup Node 22 + `npm ci`
   - **Type check**: `npx tsc --noEmit` (fails the build on type errors)
   - **D1 migrations**: `npx wrangler d1 migrations apply preboard-db --remote`
   - **OpenNext build**: `npx opennextjs-cloudflare build`
   - **Inject cron handler**: `node scripts/inject-cron.mjs` (see below)
   - **Deploy**: `npx opennextjs-cloudflare deploy`

#### Cron Injection Mechanism

OpenNext generates `.open-next/worker.js` with only a `fetch` handler. Cloudflare cron triggers fire `scheduled` events. The `scripts/inject-cron.mjs` post-build script patches the worker to:

1. Rename `export default {` to `const _worker = {`
2. Insert an `async scheduled(controller, env, ctx)` handler that maps cron patterns to trigger types (`poll`, `predict`, `all`)
3. Create a synthetic `Request` to `/api/v1/cron?trigger=<type>` and pass it to `_worker.fetch()` (no external HTTP call)
4. Re-export as `export default _worker`

Required GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

### 9.3 Monitoring

- Cloudflare Analytics (free): request volume, error rates, performance
- Cloudflare D1 Analytics: query performance, storage usage
- Cloudflare Workers Analytics: invocation counts, CPU time, errors
- Custom health endpoint (`GET /api/v1/health`): returns system status, database health, and feed counts by status (active, trial, degraded, inactive)
- Health endpoint returns version `0.2.0` and HTTP 503 when degraded

---

## 10. What Remains Manual

| Task | Why Manual | Frequency |
|------|-----------|-----------|
| Writing a brand-new adapter type | New protocol nobody's seen before | 2-3x per year |
| API key registration | FlightAware and paid APIs need account setup | Once per vendor |
| Investigating persistent anomalies | System flags it, human decides | Rare |
| Legal review of data source | Some airports may have ToS restrictions | As discovered |
| Domain/DNS management | Initial setup | Once |

Everything else is fully autonomous.

---

## 11. Growth Path

| Phase | Timeline | Milestone |
|-------|----------|-----------|
| **MVP Launch** | Weeks 1-8 | Map + 400 airports (predicted) + ~20 live feeds + crowdsource + API |
| **Autonomous Growth** | Months 3-6 | System discovers 30+ additional feeds, 200+ checkpoints crowd-discovered |
| **B2B API** | Months 6-12 | Paid API tiers for airlines, OTAs, TMCs. Airport SaaS dashboard. |
| **Mobile** | Month 9+ | React Native app (shared API, most logic server-side) |
| **International** | Year 2+ | Heathrow, Schiphol, Dubai, Changi (airports with existing sensor infrastructure) |
| **Full Airport Experience** | Year 2+ | Customs/CBP, baggage claim, parking, ground transport |

---

## 12. Non-Goals (Explicitly Out of Scope for V1)

- Native mobile apps (web-first, mobile app is Phase 2)
- International airports (US-only for V1)
- Customs/immigration wait times (TSA security only for V1)
- User accounts required for basic usage (anonymous-first)
- Payment processing or premium subscriptions (free for V1)
- Airport indoor maps or wayfinding
- Baggage claim or parking wait times
- Social features or gamification
