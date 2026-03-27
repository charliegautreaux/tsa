# PreBoard.ai

Real-time TSA security line wait times for every US airport.

**Live**: https://preboard.cgautreauxnc.workers.dev
**Repo**: https://github.com/charliegautreaux/tsa

---

## Architecture Overview

PreBoard.ai runs entirely on the Cloudflare edge. A Next.js 15 frontend serves a dark-mode airport grid backed by a data pipeline that polls 57 active feeds every minute, fuses readings into a single wait-time signal, and stores everything in Cloudflare D1.

| Layer | Technology | Cloudflare Service |
|-------|-----------|-------------------|
| Frontend | Next.js 15, React 19, Tailwind 4 | Workers (via opennextjs-cloudflare) |
| API | REST route handlers under `/api/v1` | Workers |
| Database | SQLite (9 tables) | D1 |
| Cache | Hot snapshot of current waits + map data | KV |
| Cron | Feed polling, predictions, rollup, discovery | Workers Scheduled |
| Build | opennextjs-cloudflare + inject-cron.mjs | GitHub Actions |

### Data Flow

```
External feeds (sensors, APIs, crowd)
        |
  [Cron: every 1 min]  poll-feeds.ts --> adapters --> process-reading.ts --> fusion.ts
        |
        v
  D1: readings table  ---[hourly]--->  readings_rollup table
        |
  D1: current_waits   --->  KV: CACHE
        |
  [Cron: every 5 min]  run-predictions.ts --> D1: predictions table
        |
        v
  REST API (/api/v1/*)  --->  Next.js SSR pages
```

### Data Freshness Tiers

| Tier | Freshness | Source | Badge |
|------|-----------|--------|-------|
| LIVE | <30 seconds | Airport sensor APIs (BlipTrack, Xovis) | Green pulsing "LIVE" |
| NEAR-LIVE | 1-2 minutes | API polling + crowdsourced + flight correlation | Blue "~1 min ago" |
| PREDICTED | Updated every 60s | ML model (historical + weather + flights) | Orange "Predicted" |
| STALE | >10 minutes | Last known data | Red "Last update: X min ago" |

### Data Retention

- **Raw readings**: 7 days in `readings` table
- **Hourly rollups**: Indefinite in `readings_rollup` table
- **Rollup process**: Every hour, readings older than 6 hours are aggregated before raw data ages out
- **Predictions**: Pruned after 24 hours

---

## Quick Start

### Prerequisites

- Node.js 22+
- npm
- Wrangler CLI (`npm i -g wrangler`)
- Cloudflare account (for remote deployment)

### Local Development

```bash
# Install dependencies
npm ci

# Apply migrations to local D1
npm run db:migrate:local

# Seed airport data (local)
npm run db:seed:local

# Seed development test data
npm run db:seed:dev

# Start dev server (Next.js Turbopack)
npm run dev
```

### Preview (Cloudflare local emulation)

```bash
npm run preview
```

This runs `opennextjs-cloudflare build`, injects the cron handler, and starts `wrangler dev` with full D1/KV bindings.

### Type Check

```bash
npx tsc --noEmit
```

### Test

```bash
npm test          # watch mode
npm run test:run  # single run
```

---

## Deployment

### CI/CD Pipeline

Pushing to `main` triggers the GitHub Actions workflow at `.github/workflows/deploy.yml`:

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `actions/checkout@v4` | Clone repo |
| 2 | `actions/setup-node@v4` (Node 22) | Setup runtime |
| 3 | `npm ci` | Install deps |
| 4 | `npx tsc --noEmit` | Type check gate |
| 5 | `npx wrangler d1 migrations apply preboard-db --remote` | Apply D1 schema changes |
| 6 | `npx opennextjs-cloudflare build` | Build Next.js for Workers |
| 7 | `node scripts/inject-cron.mjs` | Inject `scheduled` handler into worker |
| 8 | `npx opennextjs-cloudflare deploy` | Deploy to Cloudflare |

A concurrency group (`deploy-production`) prevents overlapping deploys.

### Cron Injection

OpenNext builds a worker with only a `fetch` handler. Cloudflare cron triggers fire `scheduled` events. The `scripts/inject-cron.mjs` post-build script patches `.open-next/worker.js` to add a `scheduled` handler that creates a synthetic request to `/api/v1/cron` and routes it through the existing fetch handler. No external HTTP call is made.

### Manual Deploy

```bash
npm run deploy
```

### Environment

Required GitHub Actions secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

---

## Cloudflare Bindings

From `wrangler.jsonc`:

```jsonc
{
  "name": "preboard",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "preboard-db",
    "database_id": "355fc969-6226-44e3-bb93-647776f5e571"
  }],
  "kv_namespaces": [{
    "binding": "CACHE",
    "id": "3c866805a565470eb48ab57fe199df3b"
  }],
  "triggers": {
    "crons": ["* * * * *", "*/5 * * * *", "0 * * * *", "0 */6 * * *"]
  },
  "vars": {
    "ENVIRONMENT": "production",
    "NEXT_PUBLIC_SITE_URL": "https://preboard.cgautreauxnc.workers.dev"
  }
}
```

---

## Cron Schedule

| Pattern | Frequency | Trigger Type | Operations |
|---------|-----------|-------------|------------|
| `* * * * *` | Every minute | `poll` | Poll active feeds, health check |
| `*/5 * * * *` | Every 5 min | `predict` | Evaluate trial feeds, run predictions |
| `0 * * * *` | Hourly | `all` | Reset counters, rollup aggregation, self-heal, prune old data |
| `0 */6 * * *` | Every 6 hours | `all` | Discovery scan for new feeds |

---

## Database Schema

All tables live in a single Cloudflare D1 database (`preboard-db`).

| Table | Purpose | Retention |
|-------|---------|-----------|
| `airports` | Airport registry (IATA, location, data tier, size) | Permanent |
| `checkpoints` | Checkpoint definitions per airport | Permanent |
| `feeds` | Feed registry with autonomous lifecycle status | Permanent |
| `readings` | Raw wait-time readings (time-series) | 7 days |
| `readings_rollup` | Hourly aggregated wait-time data | Indefinite |
| `current_waits` | Materialized snapshot, one row per checkpoint+lane | Overwritten each cycle |
| `predictions` | Precomputed forecasts per checkpoint+lane+time | 24 hours |
| `discovery_log` | Autonomous feed scanner results | Permanent |
| `reports` | Crowdsourced user wait-time submissions | Permanent |
| `report_rate_limits` | Spam prevention for report submissions | Rolling window |
| `user_preferences` | Saved airports, notification settings | Permanent |

Migrations are in `/migrations`:
- `0001_initial_schema.sql` -- All core tables
- `0002_readings_rollup.sql` -- Hourly rollup table and indexes

---

## API Reference

Base URL: `/api/v1`

### Airport Endpoints

| Method | Path | Description | Cache |
|--------|------|-------------|-------|
| GET | `/airports` | List all airports with current status | 60s |
| GET | `/airports/:code` | Single airport detail | 30s |
| GET | `/airports/:code/live` | Real-time snapshot (all checkpoints, all lanes) | 10s |
| GET | `/airports/:code/predict` | Prediction for next 4 hours | 60s |
| GET | `/airports/:code/history` | Historical readings (dual-mode) | 60s (raw), 300s (rollup) |
| GET | `/airports/:code/checkpoints` | Checkpoint definitions + current status | 30s |

#### History API (Dual-Mode)

The history endpoint serves two data sources based on the requested time range:

- `?hours=N` (N <= 168): Returns raw readings from the `readings` table
- `?days=N` or `?hours=N` (N > 168): Returns hourly rollup data from `readings_rollup`

Both modes accept an optional `?checkpoint=ID` filter.

### Map & Stats

| Method | Path | Description | Cache |
|--------|------|-------------|-------|
| GET | `/map/overview` | All airports with current wait + tier | 30s |
| GET | `/map/worst` | Top 10 worst airports right now | 30s |
| GET | `/stats/national` | National summary statistics | 60s |

### Operations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/reports` | Submit crowdsourced wait-time report |
| GET | `/cron` | Internal cron trigger endpoint (auth-gated) |
| GET | `/health` | System health + feed status summary |

---

## Adapter System

13 feed adapters in `src/lib/adapters/`, all implementing the `FeedAdapter` interface:

| Adapter | File | Purpose |
|---------|------|---------|
| Base interface | `base.ts` | `FeedAdapter` interface definition |
| Registry | `registry.ts` | Adapter lookup by type |
| BlipTrack | `bliptrack.ts` | BlipTrack/Veovo sensor protocol |
| Xovis | `xovis.ts` | Xovis 3D sensor protocol |
| Airport JSON | `airport-json.ts` | Generic JSON airport feeds |
| Airport HTML | `airport-html.ts` | HTML scraping (last resort) |
| Dynamic JSON | `dynamic-json.ts` | Config-driven JSONPath mapper (no code deploy) |
| FAA SWIM | `faa-swim.ts` | FAA SWIM data stream |
| FlightAware | `flightaware.ts` | FlightAware AeroAPI |
| NOAA | `noaa.ts` | NOAA METAR/TAF weather |
| TSA Throughput | `tsa-throughput.ts` | TSA daily passenger data |
| TrayTable | `traytable.ts` | TrayTable wait-time data |
| Crowdsource | `crowdsource.ts` | User-submitted reports |

### Feed Lifecycle

Feeds progress through an autonomous lifecycle:

```
pending --> trial --> active --> degraded --> dormant --> dead
                        ^          |
                        +----------+  (self-heal recovery)
```

- **pending**: Discovered, not yet validated
- **trial**: 24-hour validation period (polled every 5 min)
- **active**: Reliable, polled at configured interval
- **degraded**: Error rate elevated, reduced poll frequency
- **dormant**: Dead for 7+ days, retried periodically
- **dead**: Dead for 30+ days, no longer retried

---

## Frontend

### UI Design

- **Dark mode default** with `next-themes` (system detection + manual toggle)
- **Glass morphism** card system: frosted glass backgrounds, subtle border glow, backdrop blur
- **Severity glow**: Cards glow green/yellow/orange/red based on wait-time severity
- **Atmospheric background**: Radial gradient mesh with purple/blue tints
- **Stagger animations**: Cards animate in with sequential delays
- **Gradient text**: Heading text uses white-to-slate gradient in dark mode

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `page.tsx` | Airport grid with national stats, search, sort |
| `/airports/[code]` | `airports/[code]/page.tsx` | Airport detail with checkpoints, history |

### Component Structure

```
src/components/
  airport/       airport-card.tsx, checkpoint-row.tsx
  layout/        footer.tsx, top-nav.tsx
  search/        search components
  shared/        data-tier-badge.tsx, wait-badge.tsx, sparkline.tsx
```

### Color Scale

| Wait Time | Color | CSS Custom Property |
|-----------|-------|-------------------|
| 0-15 min | Green | `--color-wait-low: #22c55e` |
| 15-30 min | Yellow | `--color-wait-moderate: #eab308` |
| 30-60 min | Orange | `--color-wait-high: #f97316` |
| 60+ min | Red | `--color-wait-severe: #ef4444` |

---

## Project Structure

```
src/
  app/
    page.tsx                          Homepage (airport grid)
    layout.tsx                        Root layout (dark mode, nav, footer)
    globals.css                       Dark mode glass morphism styles
    airports/[code]/page.tsx          Airport detail page
    api/v1/
      airports/route.ts              GET /airports
      airports/[code]/route.ts       GET /airports/:code
      airports/[code]/live/route.ts  GET /airports/:code/live
      airports/[code]/predict/       GET /airports/:code/predict
      airports/[code]/history/       GET /airports/:code/history
      airports/[code]/checkpoints/   GET /airports/:code/checkpoints
      cron/route.ts                  Cron trigger endpoint
      health/route.ts                Health check
      map/overview/route.ts          Map overview data
      map/worst/route.ts             Worst airports
      reports/route.ts               POST crowdsource reports
      stats/national/route.ts        National statistics
  components/
    airport/                         Airport card, checkpoint row
    layout/                          Top nav, footer
    search/                          Search components
    shared/                          Data tier badge, wait badge, sparkline
  lib/
    adapters/                        13 feed adapters (see Adapter System)
    db/d1.ts                         D1 queries
    db/kv.ts                         KV cache helpers
    types/feed.ts                    Feed, adapter, discovery types
    utils/                           Trend, validation, color utilities
  workers/
    scheduled.ts                     Cron entry point with hourly rollup
    ingestion/
      poll-feeds.ts                  Main polling orchestrator
      process-reading.ts             Normalize, validate, store
      fusion.ts                      Multi-source data fusion
    prediction/
      run-predictions.ts             ML prediction engine
    discovery/
      scanner.ts                     Probe airports for new feeds
      validator.ts                   Trial feed evaluation
    health/
      monitor.ts                     Feed health tracking
      self-heal.ts                   Auto-recovery logic
    durable-objects/
      airport-hub.ts                 WebSocket hub (not currently deployed)
migrations/
  0001_initial_schema.sql
  0002_readings_rollup.sql
scripts/
  inject-cron.mjs                    Post-build cron handler injection
  seed-dev-data.ts                   Dev data seeder
  seed-airports.ts                   Airport registry seeder
tests/
  api/health.test.ts
.github/workflows/deploy.yml         CI/CD pipeline
wrangler.jsonc                       Cloudflare bindings
```

---

## npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev --turbopack` | Local dev server |
| `build` | `next build` | Standard Next.js build |
| `preview` | opennextjs-cloudflare build + inject-cron + wrangler dev | Local Cloudflare preview |
| `deploy` | opennextjs-cloudflare build + inject-cron + wrangler deploy | Manual production deploy |
| `db:migrate:local` | `wrangler d1 migrations apply preboard-db --local` | Apply migrations locally |
| `db:migrate:remote` | `wrangler d1 migrations apply preboard-db --remote` | Apply migrations to production |
| `db:seed:local` | `npx tsx scripts/seed-airports.ts --local` | Seed airports locally |
| `db:seed:remote` | `npx tsx scripts/seed-airports.ts --remote` | Seed airports in production |
| `db:seed:dev` | `npx tsx scripts/seed-dev-data.ts` | Seed development test data |
| `lint` | `next lint` | ESLint |
| `test` | `vitest` | Run tests (watch mode) |
| `test:run` | `vitest run` | Run tests (single pass) |

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^16.2.1 | Framework (App Router, SSR on Workers) |
| react / react-dom | ^19.2.4 | UI library |
| tailwindcss | ^4.2.2 | Styling |
| next-themes | ^0.4.6 | Dark mode |
| lucide-react | ^1.7.0 | Icons |
| @opennextjs/cloudflare | ^1.18.0 | Cloudflare Workers adapter for Next.js |
| wrangler | ^4.77.0 | Cloudflare CLI |
| vitest | ^4.1.1 | Test runner |
| typescript | ^6.0.2 | Type checking |

---

## Known Limitations

- **Durable Objects not deployed**: The `airport-hub.ts` Durable Object exists in source but is not bound in `wrangler.jsonc`. WebSocket real-time push is not active. The DO binding was removed to resolve CI build issues.
- **No R2 binding**: Map tiles and static seed data via R2 are not yet configured. The map view is not implemented.
- **No WebSocket endpoint**: The `/ws/live` endpoint from the design spec is not implemented (depends on Durable Objects).
- **Admin views not built**: The `/admin` routes from the design spec are not yet implemented.
