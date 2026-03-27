# PreBoard.ai — Design Specification

**Product**: PreBoard.ai — Real-time TSA security line visibility for every US airport
**Domain**: preboard.ai
**Tagline**: "Check PreBoard before you board."
**Date**: 2026-03-25
**Status**: Approved for implementation

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
| Frontend | Next.js 15 (App Router), React 19, Tailwind 4, shadcn/ui | **Pages** (free: unlimited requests + bandwidth) | $0 |
| API | REST + WebSocket endpoints | **Workers** (free: 100K req/day) | $0-5/mo |
| Realtime | WebSocket pub/sub per airport | **Durable Objects** (free tier) | $0-5/mo |
| Database | SQLite (all data: readings, airports, feeds, reports, users) | **D1** (free: 5GB, 5M reads/day, 100K writes/day) | $0 |
| Cache | Current wait snapshot, hot data | **KV** (free: 100K reads/day) | $0 |
| Static Assets | Map tiles, seed data | **R2** (free: 10GB, 1M reads/mo) | $0 |
| Cron Jobs | Feed polling, predictions, discovery | **Workers Scheduled** (free) | $0 |
| Map | MapLibre GL JS + Protomaps tiles on R2 | **R2** (self-hosted tiles) | $0 |
| **Total** | **One account. One deploy. One bill.** | | **$0/mo (+ ~$7/mo domain)** |

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

No code deploy needed. Stored in Turso. Worker reads mapping at poll time.

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

Base URL: `https://preboard.ai/api/v1`

| Method | Endpoint | Description | Cache |
|--------|----------|-------------|-------|
| GET | `/airports` | All airports with current status | 60s |
| GET | `/airports/:code` | Single airport detail | 30s |
| GET | `/airports/:code/live` | Real-time snapshot (all checkpoints, all lanes) | 10s |
| GET | `/airports/:code/predict` | Prediction for next 4 hours | 60s |
| GET | `/airports/:code/history` | Last 24h of readings | 60s |
| GET | `/airports/:code/checkpoints` | Checkpoint definitions + current status | 30s |
| GET | `/map/overview` | All airports with current wait + tier (misery map data) | 30s |
| GET | `/map/worst` | Top 10 worst airports right now | 30s |
| GET | `/stats/national` | National summary stats | 60s |
| POST | `/reports` | Submit crowdsourced wait time report | - |
| GET | `/health` | System health + feed status summary | 10s |
| WS | `/ws/live` | WebSocket stream (subscribe to airport codes) | - |

### 5.2 WebSocket Protocol

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

### 7.1 Views

**Home / Misery Map** (`/`)
- Full-viewport interactive MapLibre GL map of the US
- Airport dots: color-coded (green/yellow/orange/red by wait time), sized by traffic volume, pulsing animation for live-data airports
- Bottom bar: scrolling "WORST RIGHT NOW" with top worst airports
- National stats bar: airports reporting delays, average wait, vs typical
- Hover airport dot → tooltip with name + current wait
- Click airport dot → navigate to detail view

**Airport Detail** (`/airport/[code]`)
- Header: airport name, code, data tier badge, save/share buttons
- Checkpoint cards: one per checkpoint, showing all lanes (standard/precheck/clear) with colored bars, wait minutes, trend arrows
- "When should I arrive?" calculator: enter flight number or departure time, get recommended arrival time and best checkpoint
- Prediction chart: next 4 hours, area chart with standard/precheck/clear lines, highlighted best-time window
- 24h history: sparkline chart
- Recent crowd reports: latest user-submitted reports with timestamps
- Flight status: departures summary, on-time %, delays, cancellations, weather
- Tips: auto-generated from historical data (e.g., "South checkpoint is typically 40% faster")

**Report** (`/report`)
- GPS auto-detects airport (with manual override)
- Checkpoint picker (auto-populated from airport's known checkpoints)
- Lane picker (standard / precheck / clear)
- Wait time picker (tap-to-select time buckets: <5, 10, 20, 30, 45, 60, 60+)
- Optional quick note text field
- No account required. Single-tap submit.

**Admin** (`/admin` — auth-gated, internal only)
- Feeds dashboard: list all feeds, status, reliability scores, last seen
- Airports dashboard: registry management
- Discovery log: what the scanner found, trial status
- System health: overall uptime, data freshness across tiers
- Manual feed add/test (escape hatch for edge cases)

### 7.2 Design System

| Element | Choice | Rationale |
|---------|--------|-----------|
| Component library | shadcn/ui | Beautiful defaults, fully customizable, Tailwind-native |
| CSS framework | Tailwind CSS 4 | Utility-first, excellent DX, tree-shaking |
| Map library | MapLibre GL JS | Free, open-source, Mapbox-quality, no per-request cost |
| Map tiles | Protomaps (self-hosted on CF) or Stadia Maps free tier | $0 tile cost |
| Charts | Recharts | Lightweight, React-native, good sparklines and area charts |
| Search | cmdk | cmd+k airport search palette, modern UX pattern |
| Animations | Framer Motion | Smooth transitions, dot pulsing, card reveals |
| Theme | next-themes | System-detect + manual toggle, zero flash |
| Font | Inter (body) + JetBrains Mono (data) | Clean, readable, free, monospace for numbers |
| Icons | Lucide | Consistent, tree-shakeable, shadcn-native |

### 7.3 Color Scale (Wait Times)

| Range | Color | Hex (Light) | Hex (Dark) |
|-------|-------|-------------|------------|
| 0-15 min | Green | #22c55e | #4ade80 |
| 15-30 min | Yellow | #eab308 | #facc15 |
| 30-60 min | Orange | #f97316 | #fb923c |
| 60+ min | Red | #ef4444 | #f87171 |

### 7.4 Responsive Breakpoints

- **Desktop** (1024px+): Full map with sidebar for worst airports. Airport detail: 2-column layout.
- **Tablet** (768-1024px): Full map, overlay cards on tap. Airport detail: stacked single column.
- **Mobile** (<768px): Map fills viewport, bottom sheet for airport list. Tap airport → bottom sheet expands to full detail. Report: fullscreen flow with big tap targets. GPS auto-detects "Your Airport" on load.

---

## 8. Project Structure

```
src/
├── app/                          Next.js App Router (frontend)
│   ├── (public)/                 public-facing routes
│   │   ├── page.tsx              hero misery map
│   │   ├── airport/[code]/
│   │   │   └── page.tsx          airport detail view
│   │   └── report/
│   │       └── page.tsx          submit wait time
│   ├── admin/                    internal admin routes
│   │   ├── page.tsx              dashboard overview
│   │   ├── feeds/page.tsx        feed management
│   │   ├── airports/page.tsx     airport registry
│   │   ├── discovery/page.tsx    discovery log
│   │   └── health/page.tsx       system health
│   ├── api/                      API route handlers
│   │   └── v1/
│   │       ├── airports/
│   │       ├── map/
│   │       ├── reports/
│   │       ├── stats/
│   │       ├── ws/
│   │       └── health/
│   ├── layout.tsx                root layout (theme, nav)
│   └── globals.css               Tailwind base styles
│
├── workers/                      Cloudflare Workers
│   ├── ingestion/
│   │   ├── poll-feeds.ts         main polling orchestrator
│   │   ├── process-reading.ts    normalize + validate + store
│   │   └── fusion.ts            multi-source data fusion
│   ├── prediction/
│   │   ├── demand-model.ts       flight-based demand estimation
│   │   ├── historical-model.ts   day/time/season patterns
│   │   └── combine.ts           ensemble prediction
│   ├── discovery/
│   │   ├── scanner.ts            probe airports for new feeds
│   │   ├── validator.ts          test discovered feeds
│   │   └── faa-sync.ts          FAA registry sync
│   ├── health/
│   │   ├── monitor.ts            feed health tracking
│   │   └── self-heal.ts         auto-recovery logic
│   └── realtime/
│       └── airport-hub.ts        Durable Object WebSocket pub/sub
│
├── lib/                          shared libraries
│   ├── adapters/                 feed adapters
│   │   ├── base.ts
│   │   ├── bliptrack.ts
│   │   ├── xovis.ts
│   │   ├── airport-json.ts
│   │   ├── airport-html.ts
│   │   ├── dynamic-json.ts
│   │   ├── faa-swim.ts
│   │   ├── flightaware.ts
│   │   ├── noaa.ts
│   │   ├── tsa-throughput.ts
│   │   └── crowdsource.ts
│   ├── registry/                 feed + airport registries
│   │   ├── feeds.ts
│   │   ├── airports.ts
│   │   └── checkpoints.ts
│   ├── db/                       database clients + queries
│   │   ├── d1.ts                 Cloudflare D1 client + queries
│   │   └── kv.ts                 Cloudflare KV cache helpers
│   ├── types/                    shared TypeScript types
│   │   ├── reading.ts
│   │   ├── airport.ts
│   │   ├── feed.ts
│   │   ├── prediction.ts
│   │   └── api.ts
│   └── utils/
│       ├── geo.ts                geolocation helpers
│       ├── time.ts               timezone + formatting
│       ├── confidence.ts         confidence scoring
│       ├── colors.ts             wait time → color mapping
│       └── validation.ts         input validation
│
├── components/                   React components
│   ├── map/
│   │   ├── MiseryMap.tsx
│   │   ├── AirportDot.tsx
│   │   ├── AirportTooltip.tsx
│   │   ├── MapLegend.tsx
│   │   └── MapControls.tsx
│   ├── airport/
│   │   ├── AirportHeader.tsx
│   │   ├── CheckpointCard.tsx
│   │   ├── LaneBar.tsx
│   │   ├── WaitTrend.tsx
│   │   ├── PredictionChart.tsx
│   │   ├── ArrivalCalculator.tsx
│   │   ├── FlightStatusBar.tsx
│   │   ├── RecentReports.tsx
│   │   └── TipsSection.tsx
│   ├── report/
│   │   ├── ReportForm.tsx
│   │   ├── CheckpointPicker.tsx
│   │   ├── LanePicker.tsx
│   │   ├── WaitTimePicker.tsx
│   │   └── QuickNote.tsx
│   ├── feed/
│   │   ├── DataTierBadge.tsx
│   │   ├── FreshnessIndicator.tsx
│   │   ├── ConfidenceMeter.tsx
│   │   └── SourceAttribution.tsx
│   ├── layout/
│   │   ├── TopNav.tsx
│   │   ├── SearchCommand.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── BottomTicker.tsx
│   │   └── Footer.tsx
│   └── shared/
│       ├── TrendArrow.tsx
│       ├── ColorScale.tsx
│       ├── PulseAnimation.tsx
│       ├── Skeleton.tsx
│       └── ErrorBoundary.tsx
│
├── hooks/                        React hooks
│   ├── useAirport.ts
│   ├── useWebSocket.ts
│   ├── useGeolocation.ts
│   ├── useTheme.ts
│   └── useMapInteraction.ts
│
├── data/                         static seed data
│   ├── airports.json             FAA NPIAS airport database
│   ├── checkpoints.json          known checkpoint definitions
│   └── feeds.seed.json           initial feed configurations
│
└── config/
    ├── feeds.config.ts           feed polling settings
    ├── adapters.config.ts        adapter registry
    ├── prediction.config.ts      model parameters
    └── discovery.config.ts       discovery scan patterns
```

---

## 9. Hosting & Deployment

### 9.1 Infrastructure (100% Cloudflare)

| Cloudflare Service | Purpose | Free Tier | Monthly Cost |
|-------------------|---------|-----------|-------------|
| Pages | Next.js frontend (SSR + static) | Unlimited requests + bandwidth | $0 |
| Workers | API + cron ingestion + prediction | 100K req/day (~3M/mo) | $0 |
| D1 | All data (readings, airports, feeds, reports) | 5GB, 5M reads/day, 100K writes/day | $0 |
| Durable Objects | WebSocket pub/sub hubs | 100K req/day | $0 |
| KV | Cache layer (current_waits, map overview) | 100K reads/day | $0 |
| R2 | Map tiles, static assets | 10GB, 1M reads/mo | $0 |
| Domain (preboard.ai) | .ai TLD | ~$80/year | ~$7/mo |
| **Total at launch** | | | **~$7/mo** |
| **Total at scale (100K MAU)** | Workers $5 + D1 $5 | | **~$17/mo** |

### 9.2 Deployment Pipeline

- Git push to `main` → Cloudflare Pages auto-deploys frontend + workers
- Preview deployments on every PR (Cloudflare Pages preview URLs)
- D1 migrations via Wrangler CLI (`wrangler d1 migrations apply`)
- Zero-downtime deploys (Cloudflare edge rollout)
- Single CLI: `wrangler` manages everything (Pages, Workers, D1, KV, R2, DO)

### 9.3 Monitoring

- Cloudflare Analytics (free): request volume, error rates, performance
- Cloudflare D1 Analytics: query performance, storage usage
- Cloudflare Workers Analytics: invocation counts, CPU time, errors
- Custom health endpoint (`/api/v1/health`): feed status, data freshness, system state
- Webhook alerts to Slack/Discord for system-level issues

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
