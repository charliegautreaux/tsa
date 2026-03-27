# PreBoard.ai — Project Status

> Last updated: 2026-03-27

## Overview

PreBoard.ai is a real-time TSA security checkpoint wait time tracker for 329 US airports. Built on Next.js 15 + Cloudflare Workers with D1 database, KV cache, and a multi-adapter data ingestion pipeline.

**Live URL**: https://preboard.ai
**Domain**: preboard.ai (all references migrated from preboard.cgautreauxnc.workers.dev)

---

## Architecture

```
Next.js 15 (App Router) → OpenNext → Cloudflare Workers
├── D1 Database (preboard-db) — all application data
├── KV (CACHE) — hot cache for current waits + map overview
├── Cron Triggers — 1min, 5min, hourly, 6-hourly data ingestion
└── Static Assets — served from .open-next/assets
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Server Components) |
| Runtime | Cloudflare Workers via @opennextjs/cloudflare |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| Styling | Tailwind CSS v4 + custom glassmorphism system |
| Theme | Dark mode only (forced via class + @custom-variant) |
| Analytics | Google Analytics 4 (G-0VL0KV6SVJ) |
| Ads | Google AdSense (ca-pub-6421284949564984) |
| CI/CD | GitHub Actions → Cloudflare Pages |

### Key Config Files
- `wrangler.jsonc` — Cloudflare bindings (D1, KV, crons, env vars)
- `open-next.config.ts` — OpenNext adapter config
- `tailwind.config.ts` — Tailwind v4 theme (NOTE: mostly ignored by v4, CSS config in globals.css takes precedence)
- `postcss.config.mjs` — @tailwindcss/postcss
- `src/app/globals.css` — Tailwind v4 CSS config, custom variants, glassmorphism, animations

---

## What's Built & Working

### Frontend Pages
| Page | Route | Status |
|------|-------|--------|
| Homepage | `/` | Live — airport grid with search, sort, infinite scroll |
| Airport Detail | `/airports/[code]` | Live — checkpoint-level wait times, forecast chart |
| Airport Guide | `/airports/[code]/guide` | Live — peak hours, FAQ schema, ad slots |
| Blog Index | `/blog` | Live — blog post listing |
| Blog Post | `/blog/[slug]` | Live — markdown blog posts |
| Privacy Policy | `/privacy` | Live |
| Affiliate Disclosure | `/disclosure` | Live |
| Incident Report | `/report` | Live — user-submitted wait time reports |

### Components
| Component | Path | Description |
|-----------|------|-------------|
| AirportGrid | `src/components/airport/airport-grid.tsx` | Client-side search, 5 sort modes, infinite scroll (30/batch) |
| SortPills | `src/components/airport/sort-pills.tsx` | Wait Time, Nearest, Size, A-Z, State sort buttons |
| AirportCard | `src/components/airport/airport-card.tsx` | Individual airport card with sparkline + wait badge |
| CheckpointRow | `src/components/airport/checkpoint-row.tsx` | Checkpoint detail with standard/precheck/CLEAR lanes |
| AdSlot | `src/components/ads/ad-slot.tsx` | AdSense ad unit with `adsbygoogle.push()` |
| CookieBanner | `src/components/consent/cookie-banner.tsx` | GDPR consent banner, updates gtag consent |
| TopNav | `src/components/layout/top-nav.tsx` | Navigation bar with search |
| AirportSearch | `src/components/search/airport-search.tsx` | Global airport search |
| ForecastChart | `src/components/shared/forecast-chart.tsx` | Wait time prediction chart |
| Sparkline | `src/components/shared/sparkline.tsx` | Mini SVG sparkline for airport cards |

### API Routes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/airports` | GET | List all airports |
| `/api/v1/airports/[code]` | GET | Single airport detail |
| `/api/v1/airports/[code]/live` | GET | Current wait times |
| `/api/v1/airports/[code]/history` | GET | Historical readings |
| `/api/v1/airports/[code]/predict` | GET | Wait time predictions |
| `/api/v1/airports/[code]/checkpoints` | GET | Checkpoint list |
| `/api/v1/stats/national` | GET | National stats (avg wait, worst airport) |
| `/api/v1/map/overview` | GET | Map overview data |
| `/api/v1/map/worst` | GET | Worst wait times for map |
| `/api/v1/health` | GET | System health check |
| `/api/v1/cron` | POST | Manual cron trigger |
| `/api/v1/reports` | POST | User wait time reports |

### Data Pipeline
| Component | Path | Description |
|-----------|------|-------------|
| Scheduled Worker | `src/workers/scheduled.ts` | Cron entry point dispatching to ingestion/prediction/discovery |
| Poll Feeds | `src/workers/ingestion/poll-feeds.ts` | Fetches data from all active feed sources |
| Process Reading | `src/workers/ingestion/process-reading.ts` | Normalizes raw readings into standard format |
| Fusion Engine | `src/workers/ingestion/fusion.ts` | Merges multiple data sources for single airport |
| Predictor | `src/workers/prediction/predictor.ts` | ML-lite wait time predictions |
| Forecast | `src/workers/prediction/forecast.ts` | Time-series forecasting |
| Historical | `src/workers/prediction/historical.ts` | Historical pattern analysis |
| Weather | `src/workers/prediction/weather.ts` | Weather impact on wait times |
| Discovery Scanner | `src/workers/discovery/scanner.ts` | Discovers new airport data feeds |
| Validator | `src/workers/discovery/validator.ts` | Validates discovered feeds |
| Health Monitor | `src/workers/health/monitor.ts` | Feed health monitoring |
| Self-Heal | `src/workers/health/self-heal.ts` | Auto-recovery for failed feeds |

### Data Adapters (12 feed types)
| Adapter | File | Description |
|---------|------|-------------|
| airport-html | `src/lib/adapters/airport-html.ts` | HTML scraping for airport websites |
| airport-json | `src/lib/adapters/airport-json.ts` | JSON API endpoints |
| dynamic-json | `src/lib/adapters/dynamic-json.ts` | Dynamic/JS-rendered JSON feeds |
| bliptrack | `src/lib/adapters/bliptrack.ts` | BlipTrack wait time systems |
| crowdsource | `src/lib/adapters/crowdsource.ts` | Crowdsourced reports |
| faa-swim | `src/lib/adapters/faa-swim.ts` | FAA SWIM data feed |
| flightaware | `src/lib/adapters/flightaware.ts` | FlightAware data |
| noaa | `src/lib/adapters/noaa.ts` | NOAA weather data |
| traytable | `src/lib/adapters/traytable.ts` | TrayTable format feeds |
| tsa-throughput | `src/lib/adapters/tsa-throughput.ts` | TSA throughput data |
| xovis | `src/lib/adapters/xovis.ts` | Xovis sensor systems |

### Database Schema
- `migrations/0001_initial_schema.sql` — airports, checkpoints, feeds, readings, reports, predictions
- `migrations/0002_readings_rollup.sql` — aggregated readings view

### Seed Data
- `src/data/airports-seed.json` — 329 US commercial airports from FAA NPIAS data
- `src/data/tz-lookup.json` — Timezone bounding box data
- `scripts/seed-airports.ts` — Seeds airports to D1 (local + remote)
- `scripts/generate-seed-data.ts` — Generates seed JSON from embedded FAA data
- `scripts/fetch-faa-airports.ts` — Fetches live FAA data (URL currently 404)

### Polling Configuration
- `src/lib/config/polling.config.ts` — Tiered polling intervals by airport size:
  - Large hub: 1 min
  - Medium hub: 5 min
  - Small hub: 15 min
  - Non-hub: 30 min
- `src/lib/config/discovery.config.ts` — Feed discovery patterns and priorities

---

## Monetization Setup

### Google AdSense
- **Publisher ID**: `ca-pub-6421284949564984`
- **Script**: In `<head>` of layout.tsx (raw `<script>` tag for crawler visibility)
- **ads.txt**: `public/ads.txt` — live at preboard.ai/ads.txt
- **Ad Placements** (5 slots):
  1. Home feed (after 8th card) — leaderboard
  2. Airport detail page — leaderboard
  3. Airport guide top — leaderboard
  4. Airport guide mid — rectangle
  5. Blog post top — leaderboard
- **AdSlot component**: `src/components/ads/ad-slot.tsx` — renders `<ins class="adsbygoogle">` and calls `adsbygoogle.push()`
- **CLS prevention**: Min-height CSS classes in globals.css for each ad size
- **Status**: Code deployed. Awaiting AdSense domain approval (site shows "Getting ready").

### Google Analytics 4
- **Measurement ID**: `G-0VL0KV6SVJ`
- **Stream ID**: 14251260615
- **Script**: In `<head>` of layout.tsx (inline `<script>` tags)
- **Consent Mode v2**: Defaults all consent to `denied`; cookie banner updates to `granted` on accept
- **Enhanced Measurement**: Page views, scrolls, outbound clicks + 4 more enabled
- **Status**: Tags deployed. Data collection should activate within hours.

### Cookie Consent (GDPR)
- `src/components/consent/cookie-banner.tsx` — Banner with Accept/Decline
- `src/lib/utils/consent.ts` — localStorage-based consent, updates gtag consent state
- Consent categories: analytics_storage, ad_storage, ad_user_data, ad_personalization

### Affiliate Revenue
- `src/components/affiliate/precheck-cta.tsx` — TSA PreCheck affiliate CTA on airport detail pages
- `src/components/affiliate/disclosure.tsx` — FTC disclosure component
- `/disclosure` page — Full affiliate disclosure

---

## SEO

- `src/app/sitemap.ts` — Dynamic sitemap with all airports, guides, blog posts
- `src/app/robots.ts` — robots.txt allowing all crawlers
- `src/components/seo/json-ld.tsx` — Organization + BreadcrumbList structured data
- Airport guide pages have FAQ schema for rich snippets
- OpenGraph metadata on all pages
- Blog content: `src/content/blog/tsa-precheck-vs-clear.md`

---

## Design System

### Theme
- **Dark mode only** — forced via `className="dark"` on `<html>` + `forcedTheme="dark"` on ThemeProvider
- **Tailwind v4 dark mode**: `@custom-variant dark (&:where(.dark, .dark *))` in globals.css
- NOTE: `tailwind.config.ts` `darkMode: "class"` is ignored by Tailwind v4; CSS config is authoritative

### Visual System
- Glassmorphism cards (`.glass` class) with backdrop blur and subtle borders
- Severity-based glow shadows (green/yellow/orange/red) for wait time cards
- Gradient text for headings
- Staggered entrance animations (card-in keyframes)
- Live pulse animation for real-time indicators
- Color scale: `--color-wait-low` (green) → `--color-wait-severe` (red)

---

## Tests

- **Framework**: Vitest 4.1.2
- **Test count**: 129 tests across 24 test files
- **Location**: `tests/` directory
- **Coverage areas**: Adapters, utilities, API routes, components, workers, scripts

---

## CI/CD

### Deploy Pipeline
- `.github/workflows/deploy.yml` — Cloudflare Pages deploy on push to main

### Scheduled Jobs
- `.github/workflows/refresh-airports.yml` — Weekly Monday 06:00 UTC FAA data refresh
- Cloudflare cron triggers: every 1min, 5min, hourly, 6-hourly for data ingestion

---

## Known Issues / TODO

### Immediate
- [ ] AdSense domain verification pending — try "Ads.txt snippet" method if code snippet keeps failing
- [ ] GA4 "data collection isn't active" warning — should resolve within hours as pings arrive
- [ ] Only 26 of 329 airports have live data — others need active feed sources discovered/configured

### Future Work
- [ ] Increase live airport coverage (discover more feed sources, activate adapters)
- [ ] Add more blog content for SEO (target: 10+ posts covering TSA topics)
- [ ] Implement user wait time reporting flow (UI exists at /report)
- [ ] Add email alerts for wait time spikes
- [ ] Mobile app consideration (PWA already has manifest.json)
- [ ] A/B test ad placements for revenue optimization
- [ ] Add social sharing for airport wait times
- [ ] Performance monitoring dashboard for data pipeline health

### Technical Debt
- [ ] `src/components/analytics/ga-provider.tsx` is now unused (GA4 moved to layout head) — can be deleted
- [ ] `src/components/layout/theme-toggle.tsx` exists but is unnecessary with forced dark mode
- [ ] `tailwind.config.ts` is mostly redundant with Tailwind v4 CSS config — consider removing and moving typography plugin to `@plugin` directive in globals.css

---

## Accounts & IDs

| Service | ID |
|---------|-----|
| Cloudflare Account | `94971cf14d21604390757710c0a0402f` |
| D1 Database | `355fc969-6226-44e3-bb93-647776f5e571` (preboard-db) |
| KV Namespace | `3c866805a565470eb48ab57fe199df3b` |
| GA4 Measurement ID | `G-0VL0KV6SVJ` |
| GA4 Stream ID | `14251260615` |
| AdSense Publisher | `ca-pub-6421284949564984` |

---

## File Structure (Key Paths)

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (head scripts, dark mode, ThemeProvider)
│   ├── page.tsx                  # Homepage (server component → AirportGrid)
│   ├── globals.css               # Tailwind v4 config, dark mode variant, glassmorphism
│   ├── airports/[code]/          # Airport detail + guide pages
│   ├── blog/[slug]/              # Blog post pages
│   └── api/v1/                   # API routes
├── components/
│   ├── airport/                  # AirportGrid, AirportCard, SortPills, CheckpointRow
│   ├── ads/                      # AdSlot (AdSense integration)
│   ├── analytics/                # GAProvider (unused), WebVitals
│   ├── consent/                  # CookieBanner
│   ├── layout/                   # TopNav, Footer, ThemeToggle
│   ├── search/                   # AirportSearch
│   ├── seo/                      # JSON-LD structured data
│   └── shared/                   # Sparkline, WaitBadge, ForecastChart, etc.
├── lib/
│   ├── adapters/                 # 12 data feed adapters
│   ├── config/                   # Polling + discovery configuration
│   ├── db/                       # D1 queries (d1.ts) + KV cache (kv.ts)
│   ├── types/                    # TypeScript interfaces
│   └── utils/                    # Colors, time, trend, validation, consent
├── workers/
│   ├── ingestion/                # Data polling, processing, fusion
│   ├── prediction/               # Wait time forecasting
│   ├── discovery/                # Feed discovery + validation
│   ├── health/                   # Monitoring + self-healing
│   └── scheduled.ts              # Cron entry point
├── data/                         # airports-seed.json, tz-lookup.json
└── content/blog/                 # Markdown blog posts

scripts/                          # Seed data, FAA fetch, icon generation
migrations/                       # D1 SQL migrations
tests/                            # Vitest test files
docs/
├── PROJECT-STATUS.md             # This file
├── README.md                     # Technical overview
├── brand/                        # Brand guidelines
├── marketing/                    # 9-part marketing/monetization strategy
└── superpowers/
    ├── specs/                    # Design specifications
    └── plans/                    # Implementation plans
```

---

## Commands

```bash
# Development
npm run dev                        # Local dev server
npm run build                      # Production build
npm run lint                       # ESLint
npm test                           # Run all tests (vitest)

# Database
npx wrangler d1 execute preboard-db --local --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute preboard-db --remote --file=migrations/0001_initial_schema.sql
npx tsx scripts/seed-airports.ts   # Seed airports to D1 (both local + remote)

# Deploy
git push origin main               # Triggers GitHub Actions → Cloudflare deploy

# Seed data generation
npx tsx scripts/generate-seed-data.ts  # Regenerate airports-seed.json from FAA data
```
