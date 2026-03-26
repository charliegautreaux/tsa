# PreBoard.ai Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full PreBoard.ai project with Cloudflare infrastructure, D1 database, seed data for all ~400 US airports, core types, and a deployable skeleton that serves a health endpoint and placeholder pages.

**Architecture:** 100% Cloudflare stack — Next.js 15 via OpenNext on Cloudflare Pages, Workers for API/cron, D1 for all data, KV for cache, Durable Objects for realtime WebSocket. Single `wrangler.jsonc` configures everything.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, MapLibre GL JS, Cloudflare (Pages, Workers, D1, KV, R2, Durable Objects), @opennextjs/cloudflare

---

## File Structure

```
preboard/
├── .dev.vars                          # Local dev secrets (gitignored)
├── .env.example                       # Template for env vars
├── .gitignore
├── cloudflare-env.d.ts                # Cloudflare binding types
├── wrangler.jsonc                     # All Cloudflare config (D1, KV, R2, DO, cron)
├── open-next.config.ts                # OpenNext adapter config
├── next.config.ts                     # Next.js config
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── migrations/                        # D1 SQL migrations
│   └── 0001_initial_schema.sql
├── scripts/
│   └── seed-airports.ts               # Seeds D1 with FAA airport data
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (theme provider, nav)
│   │   ├── globals.css                # Tailwind base
│   │   ├── page.tsx                   # Home (placeholder → misery map)
│   │   ├── airport/
│   │   │   └── [code]/
│   │   │       └── page.tsx           # Airport detail (placeholder)
│   │   └── report/
│   │       └── page.tsx               # Report form (placeholder)
│   ├── api/
│   │   └── v1/
│   │       ├── health/route.ts        # Health check endpoint
│   │       └── airports/route.ts      # GET /api/v1/airports
│   ├── components/
│   │   ├── layout/
│   │   │   ├── top-nav.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   └── footer.tsx
│   │   └── shared/
│   │       ├── data-tier-badge.tsx
│   │       └── color-scale.ts
│   ├── lib/
│   │   ├── db/
│   │   │   └── d1.ts                  # D1 query helpers
│   │   ├── types/
│   │   │   ├── airport.ts
│   │   │   ├── reading.ts
│   │   │   ├── feed.ts
│   │   │   └── prediction.ts
│   │   └── utils/
│   │       ├── colors.ts              # Wait time → color mapping
│   │       └── time.ts                # Timezone + formatting
│   └── data/
│       └── airports-seed.json         # FAA airport data (~400 airports)
├── tests/
│   ├── lib/
│   │   ├── colors.test.ts
│   │   └── time.test.ts
│   └── api/
│       └── health.test.ts
```

---

### Task 1: Initialize Git Repository and Project

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/charliegautreaux/workspaces/tsa
git init
```

- [ ] **Step 2: Create .gitignore**

Create file `.gitignore`:

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build
.next/
.open-next/
out/

# Cloudflare
.wrangler/
.dev.vars

# Env
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Test
coverage/
```

- [ ] **Step 3: Create package.json**

```bash
npm init -y
```

Then replace contents of `package.json`:

```json
{
  "name": "preboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "preview": "opennextjs-cloudflare build && wrangler dev",
    "deploy": "opennextjs-cloudflare build && wrangler deploy",
    "db:migrate:local": "wrangler d1 migrations apply preboard-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply preboard-db --remote",
    "db:seed:local": "npx tsx scripts/seed-airports.ts --local",
    "db:seed:remote": "npx tsx scripts/seed-airports.ts --remote",
    "lint": "next lint",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 4: Install core dependencies**

```bash
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/react @types/react-dom @types/node
npm install -D @opennextjs/cloudflare wrangler
npm install -D vitest @vitejs/plugin-react
npm install -D tailwindcss @tailwindcss/postcss postcss
npm install -D tsx
```

- [ ] **Step 5: Create tsconfig.json**

Create file `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "cloudflare-env.d.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Install Cloudflare Workers types**

```bash
npm install -D @cloudflare/workers-types
```

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json
git commit -m "chore: initialize project with Next.js 15, TypeScript, Cloudflare tooling"
```

---

### Task 2: Configure Cloudflare Bindings (D1, KV, Durable Objects, Cron)

**Files:**
- Create: `wrangler.jsonc`
- Create: `open-next.config.ts`
- Create: `cloudflare-env.d.ts`
- Create: `.dev.vars`
- Create: `.env.example`

- [ ] **Step 1: Create the D1 database**

```bash
npx wrangler d1 create preboard-db
```

Copy the `database_id` from the output. You'll paste it into `wrangler.jsonc` in the next step.

- [ ] **Step 2: Create the KV namespace**

```bash
npx wrangler kv namespace create CACHE
```

Copy the `id` from the output.

- [ ] **Step 3: Create wrangler.jsonc**

Create file `wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "preboard",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],

  // Static assets
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },

  // D1 Database — all application data
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "preboard-db",
      "database_id": "PASTE_YOUR_D1_DATABASE_ID_HERE",
      "migrations_dir": "migrations"
    }
  ],

  // KV — hot cache for current waits + map overview
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "PASTE_YOUR_KV_NAMESPACE_ID_HERE"
    }
  ],

  // R2 — map tiles, static assets
  "r2_buckets": [
    {
      "binding": "TILES",
      "bucket_name": "preboard-tiles"
    }
  ],

  // Durable Objects — WebSocket hub per airport
  "durable_objects": {
    "bindings": [
      {
        "name": "AIRPORT_HUB",
        "class_name": "AirportHub"
      }
    ]
  },

  // Cron triggers for data ingestion
  "triggers": {
    "crons": [
      "* * * * *",
      "*/5 * * * *",
      "0 * * * *",
      "0 */6 * * *"
    ]
  },

  // Environment variables
  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

- [ ] **Step 4: Create OpenNext config**

Create file `open-next.config.ts`:

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
```

- [ ] **Step 5: Create Cloudflare env type declarations**

Create file `cloudflare-env.d.ts`:

```typescript
declare global {
  interface CloudflareEnv {
    // D1 Database — all application data
    DB: D1Database;

    // KV — hot cache layer
    CACHE: KVNamespace;

    // R2 — map tiles and static assets
    TILES: R2Bucket;

    // Durable Objects — realtime WebSocket hubs
    AIRPORT_HUB: DurableObjectNamespace;

    // Static assets
    ASSETS: Fetcher;

    // Environment variables
    ENVIRONMENT: string;
    FLIGHTAWARE_API_KEY?: string;
  }
}

export {};
```

- [ ] **Step 6: Create .dev.vars and .env.example**

Create file `.dev.vars`:

```ini
ENVIRONMENT=development
# FLIGHTAWARE_API_KEY=your-key-here
```

Create file `.env.example`:

```ini
ENVIRONMENT=development
FLIGHTAWARE_API_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add wrangler.jsonc open-next.config.ts cloudflare-env.d.ts .env.example
git commit -m "chore: configure Cloudflare bindings — D1, KV, R2, Durable Objects, cron"
```

---

### Task 3: D1 Database Schema Migration

**Files:**
- Create: `migrations/0001_initial_schema.sql`

- [ ] **Step 1: Create migrations directory**

```bash
mkdir -p migrations
```

- [ ] **Step 2: Write the initial schema migration**

Create file `migrations/0001_initial_schema.sql`:

```sql
-- PreBoard.ai Initial Schema
-- All tables in a single Cloudflare D1 database

-- ============================================================
-- AIRPORT REGISTRY
-- Seeded from FAA NPIAS, auto-extended by discovery + community
-- ============================================================
CREATE TABLE IF NOT EXISTS airports (
  iata TEXT PRIMARY KEY,
  icao TEXT,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  timezone TEXT NOT NULL,
  size TEXT DEFAULT 'unknown',
  annual_pax INTEGER DEFAULT 0,
  data_tier TEXT DEFAULT 'predicted',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_airports_state ON airports(state);
CREATE INDEX IF NOT EXISTS idx_airports_data_tier ON airports(data_tier);

-- ============================================================
-- CHECKPOINT DEFINITIONS
-- Auto-discovered from feeds + crowdsourced reports
-- ============================================================
CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  airport_code TEXT NOT NULL REFERENCES airports(iata),
  name TEXT NOT NULL,
  terminal TEXT,
  has_standard INTEGER DEFAULT 1,
  has_precheck INTEGER DEFAULT 1,
  has_clear INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  reopens_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_airport ON checkpoints(airport_code);

-- ============================================================
-- FEED REGISTRY
-- Autonomous lifecycle: pending → trial → active → degraded → dead
-- ============================================================
CREATE TABLE IF NOT EXISTS feeds (
  id TEXT PRIMARY KEY,
  airport_code TEXT NOT NULL REFERENCES airports(iata),
  checkpoint_id TEXT REFERENCES checkpoints(id),
  type TEXT NOT NULL,
  adapter TEXT NOT NULL,
  url TEXT,
  auth_config TEXT,
  polling_interval_sec INTEGER DEFAULT 60,
  dynamic_mapping TEXT,
  status TEXT DEFAULT 'pending',
  reliability_score REAL DEFAULT 0.0,
  last_success_at TEXT,
  last_error_at TEXT,
  last_error TEXT,
  error_count_1h INTEGER DEFAULT 0,
  success_count_1h INTEGER DEFAULT 0,
  trial_start_at TEXT,
  activated_at TEXT,
  discovered_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feeds_airport ON feeds(airport_code);
CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status);

-- ============================================================
-- WAIT TIME READINGS (time-series)
-- Core data: every reading from every source
-- ============================================================
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airport_code TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  lane_type TEXT NOT NULL,
  wait_minutes REAL NOT NULL,
  confidence REAL NOT NULL,
  source_type TEXT NOT NULL,
  feed_id TEXT,
  measured_at TEXT NOT NULL,
  ingested_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_readings_airport_time ON readings(airport_code, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_checkpoint_time ON readings(checkpoint_id, measured_at DESC);

-- ============================================================
-- CURRENT WAITS (materialized snapshot)
-- One row per checkpoint+lane, updated every poll cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS current_waits (
  airport_code TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  lane_type TEXT NOT NULL,
  wait_minutes REAL NOT NULL,
  confidence REAL NOT NULL,
  trend TEXT,
  source_type TEXT NOT NULL,
  data_tier TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (airport_code, checkpoint_id, lane_type)
);

-- ============================================================
-- PREDICTIONS
-- Precomputed forecasts, refreshed every 60 seconds
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
  airport_code TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  lane_type TEXT NOT NULL,
  forecast_time TEXT NOT NULL,
  predicted_wait REAL NOT NULL,
  confidence REAL NOT NULL,
  generated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (airport_code, checkpoint_id, lane_type, forecast_time)
);

-- ============================================================
-- FEED DISCOVERY LOG
-- What the autonomous scanner found
-- ============================================================
CREATE TABLE IF NOT EXISTS discovery_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  airport_code TEXT,
  discovered_by TEXT NOT NULL,
  probe_score REAL,
  adapter_detected TEXT,
  status TEXT DEFAULT 'discovered',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- USER REPORTS (crowdsourced)
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  airport_code TEXT NOT NULL,
  checkpoint TEXT NOT NULL,
  lane_type TEXT NOT NULL,
  wait_minutes INTEGER NOT NULL,
  note TEXT,
  lat REAL,
  lng REAL,
  ip_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_airport_time ON reports(airport_code, created_at DESC);

-- ============================================================
-- RATE LIMITING
-- ============================================================
CREATE TABLE IF NOT EXISTS report_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  report_count INTEGER DEFAULT 0,
  window_start TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  saved_airports TEXT,
  default_airport TEXT,
  notifications_enabled INTEGER DEFAULT 0,
  notification_threshold INTEGER DEFAULT 60,
  theme TEXT DEFAULT 'system',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: Apply migration locally**

```bash
npx wrangler d1 migrations apply preboard-db --local
```

Expected: `Successfully applied migration 0001_initial_schema.sql`

- [ ] **Step 4: Apply migration to remote D1**

```bash
npx wrangler d1 migrations apply preboard-db --remote
```

Expected: Same success message on remote database.

- [ ] **Step 5: Commit**

```bash
git add migrations/
git commit -m "feat: add D1 initial schema — airports, checkpoints, feeds, readings, reports"
```

---

### Task 4: Core TypeScript Types

**Files:**
- Create: `src/lib/types/airport.ts`
- Create: `src/lib/types/reading.ts`
- Create: `src/lib/types/feed.ts`
- Create: `src/lib/types/prediction.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/lib/types src/lib/db src/lib/utils src/components/layout src/components/shared src/data tests/lib tests/api scripts
```

- [ ] **Step 2: Create airport types**

Create file `src/lib/types/airport.ts`:

```typescript
export type AirportSize =
  | "large_hub"
  | "medium_hub"
  | "small_hub"
  | "nonhub"
  | "unknown";

export type DataTier = "live" | "near-live" | "predicted" | "stale";

export type CheckpointStatus = "open" | "closed" | "unknown";

export interface Airport {
  iata: string;
  icao: string | null;
  name: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  timezone: string;
  size: AirportSize;
  annual_pax: number;
  data_tier: DataTier;
  status: "active" | "inactive";
}

export interface Checkpoint {
  id: string;
  airport_code: string;
  name: string;
  terminal: string | null;
  has_standard: boolean;
  has_precheck: boolean;
  has_clear: boolean;
  status: CheckpointStatus;
  reopens_at: string | null;
}

export interface AirportOverview {
  iata: string;
  name: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  data_tier: DataTier;
  worst_wait: number | null;
  worst_trend: Trend | null;
}
```

- [ ] **Step 3: Create reading types**

Create file `src/lib/types/reading.ts`:

```typescript
export type LaneType = "standard" | "precheck" | "clear" | "unknown";

export type SourceType = "sensor" | "airport-api" | "crowdsourced" | "predicted";

export type Trend = "rising" | "falling" | "stable";

export interface NormalizedReading {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  wait_minutes: number;
  confidence: number;
  source_type: SourceType;
  measured_at: string;
  ingested_at: string;
}

export interface CurrentWait {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  wait_minutes: number;
  confidence: number;
  trend: Trend;
  source_type: SourceType;
  data_tier: string;
  updated_at: string;
}
```

- [ ] **Step 4: Create feed types**

Create file `src/lib/types/feed.ts`:

```typescript
export type FeedType =
  | "sensor-api"
  | "airport-web"
  | "government"
  | "flight-data"
  | "crowdsourced"
  | "derived";

export type FeedStatus =
  | "pending"
  | "trial"
  | "active"
  | "degraded"
  | "inactive"
  | "dormant"
  | "dead";

export type AdapterType =
  | "bliptrack"
  | "xovis"
  | "airport-json"
  | "airport-html"
  | "dynamic-json"
  | "faa-swim"
  | "flightaware"
  | "noaa"
  | "tsa-throughput"
  | "crowdsource";

export type DiscoveryMethod =
  | "known-pattern"
  | "sitemap-crawl"
  | "faa-sync"
  | "community"
  | "manual";

export interface FeedConfig {
  id: string;
  airport_code: string;
  checkpoint_id: string | null;
  type: FeedType;
  adapter: AdapterType;
  url: string | null;
  auth_config: { type: "none" } | { type: "api-key"; key: string; header: string } | { type: "bearer"; token: string };
  polling_interval_sec: number;
  dynamic_mapping: Record<string, string> | null;
  status: FeedStatus;
  reliability_score: number;
  discovered_by: DiscoveryMethod;
}

export interface FeedHealth {
  feed_id: string;
  is_healthy: boolean;
  response_time_ms: number;
  last_error: string | null;
}
```

- [ ] **Step 5: Create prediction types**

Create file `src/lib/types/prediction.ts`:

```typescript
import type { LaneType, Trend } from "./reading";

export interface Prediction {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  predicted_wait_minutes: number;
  confidence: number;
  trend: Trend;
  forecast_4h: ForecastPoint[];
  best_time: BestTimeWindow | null;
  data_sources: string[];
}

export interface ForecastPoint {
  time: string;
  predicted_wait: number;
  confidence: number;
}

export interface BestTimeWindow {
  start: string;
  end: string;
  predicted_wait: number;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/
git commit -m "feat: add core TypeScript types — airport, reading, feed, prediction"
```

---

### Task 5: Utility Functions + Tests

**Files:**
- Create: `src/lib/utils/colors.ts`
- Create: `src/lib/utils/time.ts`
- Create: `tests/lib/colors.test.ts`
- Create: `tests/lib/time.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest config**

Create file `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Write failing test for colors**

Create file `tests/lib/colors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getWaitColor,
  getWaitSeverity,
  WAIT_COLORS,
} from "@/lib/utils/colors";

describe("getWaitColor", () => {
  it("returns green for 0-15 minutes", () => {
    expect(getWaitColor(0)).toBe(WAIT_COLORS.green);
    expect(getWaitColor(10)).toBe(WAIT_COLORS.green);
    expect(getWaitColor(15)).toBe(WAIT_COLORS.green);
  });

  it("returns yellow for 16-30 minutes", () => {
    expect(getWaitColor(16)).toBe(WAIT_COLORS.yellow);
    expect(getWaitColor(25)).toBe(WAIT_COLORS.yellow);
    expect(getWaitColor(30)).toBe(WAIT_COLORS.yellow);
  });

  it("returns orange for 31-60 minutes", () => {
    expect(getWaitColor(31)).toBe(WAIT_COLORS.orange);
    expect(getWaitColor(45)).toBe(WAIT_COLORS.orange);
    expect(getWaitColor(60)).toBe(WAIT_COLORS.orange);
  });

  it("returns red for 60+ minutes", () => {
    expect(getWaitColor(61)).toBe(WAIT_COLORS.red);
    expect(getWaitColor(120)).toBe(WAIT_COLORS.red);
  });

  it("handles null/undefined as green", () => {
    expect(getWaitColor(null as unknown as number)).toBe(WAIT_COLORS.green);
  });
});

describe("getWaitSeverity", () => {
  it("returns correct severity labels", () => {
    expect(getWaitSeverity(5)).toBe("low");
    expect(getWaitSeverity(20)).toBe("moderate");
    expect(getWaitSeverity(45)).toBe("high");
    expect(getWaitSeverity(90)).toBe("severe");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/lib/colors.test.ts
```

Expected: FAIL — module `@/lib/utils/colors` not found.

- [ ] **Step 4: Implement colors utility**

Create file `src/lib/utils/colors.ts`:

```typescript
export const WAIT_COLORS = {
  green: { light: "#22c55e", dark: "#4ade80" },
  yellow: { light: "#eab308", dark: "#facc15" },
  orange: { light: "#f97316", dark: "#fb923c" },
  red: { light: "#ef4444", dark: "#f87171" },
} as const;

export type WaitColor = (typeof WAIT_COLORS)[keyof typeof WAIT_COLORS];
export type WaitSeverity = "low" | "moderate" | "high" | "severe";

export function getWaitColor(minutes: number): WaitColor {
  if (!minutes || minutes <= 15) return WAIT_COLORS.green;
  if (minutes <= 30) return WAIT_COLORS.yellow;
  if (minutes <= 60) return WAIT_COLORS.orange;
  return WAIT_COLORS.red;
}

export function getWaitSeverity(minutes: number): WaitSeverity {
  if (!minutes || minutes <= 15) return "low";
  if (minutes <= 30) return "moderate";
  if (minutes <= 60) return "high";
  return "severe";
}

export function getWaitTailwindClass(minutes: number): string {
  if (!minutes || minutes <= 15) return "text-green-500";
  if (minutes <= 30) return "text-yellow-500";
  if (minutes <= 60) return "text-orange-500";
  return "text-red-500";
}

export function getWaitBgClass(minutes: number): string {
  if (!minutes || minutes <= 15) return "bg-green-500";
  if (minutes <= 30) return "bg-yellow-500";
  if (minutes <= 60) return "bg-orange-500";
  return "bg-red-500";
}
```

- [ ] **Step 5: Run colors test to verify it passes**

```bash
npx vitest run tests/lib/colors.test.ts
```

Expected: PASS (all 5 tests).

- [ ] **Step 6: Write failing test for time utils**

Create file `tests/lib/time.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatRelativeTime, formatMinutes, isStale } from "@/lib/utils/time";

describe("formatRelativeTime", () => {
  it("returns 'just now' for <30 seconds ago", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns '1 min ago' for 60 seconds ago", () => {
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    expect(formatRelativeTime(oneMinAgo)).toBe("1 min ago");
  });

  it("returns '5 min ago' for 5 minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 300_000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 min ago");
  });

  it("returns '1 hr ago' for 60 minutes ago", () => {
    const oneHrAgo = new Date(Date.now() - 3_600_000).toISOString();
    expect(formatRelativeTime(oneHrAgo)).toBe("1 hr ago");
  });
});

describe("formatMinutes", () => {
  it("formats minutes with unit", () => {
    expect(formatMinutes(5)).toBe("5 min");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(0)).toBe("<1 min");
  });
});

describe("isStale", () => {
  it("returns false for recent timestamps", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(isStale(recent, 600)).toBe(false);
  });

  it("returns true for old timestamps", () => {
    const old = new Date(Date.now() - 900_000).toISOString();
    expect(isStale(old, 600)).toBe(true);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
npx vitest run tests/lib/time.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 8: Implement time utility**

Create file `src/lib/utils/time.ts`:

```typescript
export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 30) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

export function isStale(isoString: string, thresholdSeconds: number): boolean {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  return (now - then) / 1000 > thresholdSeconds;
}

export function toLocalTime(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
```

- [ ] **Step 9: Run time tests to verify they pass**

```bash
npx vitest run tests/lib/time.test.ts
```

Expected: PASS (all 6 tests).

- [ ] **Step 10: Run all tests**

```bash
npx vitest run
```

Expected: All 11 tests pass.

- [ ] **Step 11: Commit**

```bash
git add vitest.config.ts src/lib/utils/ tests/
git commit -m "feat: add color scale and time formatting utilities with tests"
```

---

### Task 6: D1 Query Helpers

**Files:**
- Create: `src/lib/db/d1.ts`

- [ ] **Step 1: Create D1 query helpers**

Create file `src/lib/db/d1.ts`:

```typescript
import type { Airport, AirportOverview, Checkpoint } from "@/lib/types/airport";
import type { CurrentWait, NormalizedReading } from "@/lib/types/reading";
import type { FeedConfig } from "@/lib/types/feed";

// ============================================================
// AIRPORTS
// ============================================================

export async function getAllAirports(db: D1Database): Promise<Airport[]> {
  const result = await db
    .prepare("SELECT * FROM airports WHERE status = 'active' ORDER BY annual_pax DESC")
    .all<Airport>();
  return result.results;
}

export async function getAirport(db: D1Database, code: string): Promise<Airport | null> {
  return db
    .prepare("SELECT * FROM airports WHERE iata = ?1")
    .bind(code.toUpperCase())
    .first<Airport>();
}

export async function getAirportOverview(db: D1Database): Promise<AirportOverview[]> {
  const result = await db
    .prepare(`
      SELECT
        a.iata, a.name, a.city, a.state, a.lat, a.lng, a.data_tier,
        MAX(cw.wait_minutes) as worst_wait,
        cw.trend as worst_trend
      FROM airports a
      LEFT JOIN current_waits cw ON a.iata = cw.airport_code AND cw.lane_type = 'standard'
      WHERE a.status = 'active'
      GROUP BY a.iata
      ORDER BY worst_wait DESC NULLS LAST
    `)
    .all<AirportOverview>();
  return result.results;
}

export async function upsertAirport(db: D1Database, airport: Airport): Promise<void> {
  await db
    .prepare(`
      INSERT INTO airports (iata, icao, name, city, state, lat, lng, timezone, size, annual_pax, data_tier, status)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      ON CONFLICT(iata) DO UPDATE SET
        name = excluded.name,
        city = excluded.city,
        state = excluded.state,
        lat = excluded.lat,
        lng = excluded.lng,
        timezone = excluded.timezone,
        size = excluded.size,
        annual_pax = excluded.annual_pax,
        updated_at = datetime('now')
    `)
    .bind(
      airport.iata, airport.icao, airport.name, airport.city, airport.state,
      airport.lat, airport.lng, airport.timezone, airport.size, airport.annual_pax,
      airport.data_tier, airport.status
    )
    .run();
}

// ============================================================
// CHECKPOINTS
// ============================================================

export async function getCheckpoints(db: D1Database, airportCode: string): Promise<Checkpoint[]> {
  const result = await db
    .prepare("SELECT * FROM checkpoints WHERE airport_code = ?1 ORDER BY name")
    .bind(airportCode.toUpperCase())
    .all<Checkpoint>();
  return result.results;
}

// ============================================================
// CURRENT WAITS
// ============================================================

export async function getCurrentWaits(db: D1Database, airportCode: string): Promise<CurrentWait[]> {
  const result = await db
    .prepare("SELECT * FROM current_waits WHERE airport_code = ?1")
    .bind(airportCode.toUpperCase())
    .all<CurrentWait>();
  return result.results;
}

export async function upsertCurrentWait(db: D1Database, wait: CurrentWait): Promise<void> {
  await db
    .prepare(`
      INSERT INTO current_waits (airport_code, checkpoint_id, lane_type, wait_minutes, confidence, trend, source_type, data_tier, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(airport_code, checkpoint_id, lane_type) DO UPDATE SET
        wait_minutes = excluded.wait_minutes,
        confidence = excluded.confidence,
        trend = excluded.trend,
        source_type = excluded.source_type,
        data_tier = excluded.data_tier,
        updated_at = excluded.updated_at
    `)
    .bind(
      wait.airport_code, wait.checkpoint_id, wait.lane_type,
      wait.wait_minutes, wait.confidence, wait.trend,
      wait.source_type, wait.data_tier, wait.updated_at
    )
    .run();
}

// ============================================================
// READINGS
// ============================================================

export async function insertReading(db: D1Database, reading: NormalizedReading): Promise<void> {
  await db
    .prepare(`
      INSERT INTO readings (airport_code, checkpoint_id, lane_type, wait_minutes, confidence, source_type, feed_id, measured_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `)
    .bind(
      reading.airport_code, reading.checkpoint_id, reading.lane_type,
      reading.wait_minutes, reading.confidence, reading.source_type,
      null, reading.measured_at
    )
    .run();
}

export async function getRecentReadings(
  db: D1Database,
  airportCode: string,
  hoursBack: number = 24
): Promise<NormalizedReading[]> {
  const since = new Date(Date.now() - hoursBack * 3600_000).toISOString();
  const result = await db
    .prepare(`
      SELECT * FROM readings
      WHERE airport_code = ?1 AND measured_at > ?2
      ORDER BY measured_at DESC
      LIMIT 1000
    `)
    .bind(airportCode.toUpperCase(), since)
    .all<NormalizedReading>();
  return result.results;
}

// ============================================================
// FEEDS
// ============================================================

export async function getActiveFeeds(db: D1Database): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE status IN ('active', 'trial', 'degraded') ORDER BY airport_code")
    .all<FeedConfig>();
  return result.results.map(parseFeedConfig);
}

export async function getFeedsForAirport(db: D1Database, airportCode: string): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE airport_code = ?1 AND status IN ('active', 'trial', 'degraded')")
    .bind(airportCode.toUpperCase())
    .all<FeedConfig>();
  return result.results.map(parseFeedConfig);
}

function parseFeedConfig(row: Record<string, unknown>): FeedConfig {
  return {
    ...row,
    auth_config: row.auth_config ? JSON.parse(row.auth_config as string) : { type: "none" },
    dynamic_mapping: row.dynamic_mapping ? JSON.parse(row.dynamic_mapping as string) : null,
  } as FeedConfig;
}

// ============================================================
// REPORTS (crowdsourced)
// ============================================================

export async function insertReport(
  db: D1Database,
  report: {
    id: string;
    airport_code: string;
    checkpoint: string;
    lane_type: string;
    wait_minutes: number;
    note: string | null;
    lat: number | null;
    lng: number | null;
    ip_hash: string;
  }
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO reports (id, airport_code, checkpoint, lane_type, wait_minutes, note, lat, lng, ip_hash)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `)
    .bind(
      report.id, report.airport_code, report.checkpoint, report.lane_type,
      report.wait_minutes, report.note, report.lat, report.lng, report.ip_hash
    )
    .run();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/
git commit -m "feat: add D1 query helpers for airports, checkpoints, readings, feeds, reports"
```

---

### Task 7: Airport Seed Data

**Files:**
- Create: `scripts/seed-airports.ts`
- Create: `src/data/airports-seed.json` (generated by script from FAA data)

- [ ] **Step 1: Create seed script**

Create file `scripts/seed-airports.ts`:

```typescript
/**
 * Seeds the D1 database with all US commercial airports from FAA data.
 * Usage:
 *   npx tsx scripts/seed-airports.ts --local   (local D1)
 *   npx tsx scripts/seed-airports.ts --remote  (remote D1)
 */

import { execSync } from "child_process";
import airports from "../src/data/airports-seed.json";

const isRemote = process.argv.includes("--remote");
const flag = isRemote ? "--remote" : "--local";

console.log(`Seeding ${airports.length} airports (${flag})...`);

// D1 has a batch limit, so we chunk into groups of 50
const CHUNK_SIZE = 50;

for (let i = 0; i < airports.length; i += CHUNK_SIZE) {
  const chunk = airports.slice(i, i + CHUNK_SIZE);
  const values = chunk
    .map(
      (a) =>
        `('${a.iata}', ${a.icao ? `'${a.icao}'` : "NULL"}, '${a.name.replace(/'/g, "''")}', '${(a.city || "").replace(/'/g, "''")}', '${a.state}', ${a.lat}, ${a.lng}, '${a.timezone}', '${a.size}', ${a.annual_pax}, 'predicted', 'active')`
    )
    .join(",\n    ");

  const sql = `INSERT OR IGNORE INTO airports (iata, icao, name, city, state, lat, lng, timezone, size, annual_pax, data_tier, status) VALUES\n    ${values};`;

  execSync(
    `npx wrangler d1 execute preboard-db ${flag} --command "${sql.replace(/"/g, '\\"')}"`,
    { stdio: "pipe" }
  );

  console.log(`  Seeded ${Math.min(i + CHUNK_SIZE, airports.length)}/${airports.length}`);
}

console.log("Done!");
```

- [ ] **Step 2: Create the airports seed data file**

This file contains the top ~400 US commercial airports. We'll generate it from public FAA data. Create file `src/data/airports-seed.json` with the major airports. Here are the first entries as the structure — the full file will contain all ~400:

```json
[
  {"iata":"ATL","icao":"KATL","name":"Hartsfield-Jackson Atlanta International","city":"Atlanta","state":"GA","lat":33.6407,"lng":-84.4277,"timezone":"America/New_York","size":"large_hub","annual_pax":93700000},
  {"iata":"DFW","icao":"KDFW","name":"Dallas/Fort Worth International","city":"Dallas-Fort Worth","state":"TX","lat":32.8998,"lng":-97.0403,"timezone":"America/Chicago","size":"large_hub","annual_pax":73400000},
  {"iata":"DEN","icao":"KDEN","name":"Denver International","city":"Denver","state":"CO","lat":39.8561,"lng":-104.6737,"timezone":"America/Denver","size":"large_hub","annual_pax":69000000},
  {"iata":"ORD","icao":"KORD","name":"O'Hare International","city":"Chicago","state":"IL","lat":41.9742,"lng":-87.9073,"timezone":"America/Chicago","size":"large_hub","annual_pax":67800000},
  {"iata":"LAX","icao":"KLAX","name":"Los Angeles International","city":"Los Angeles","state":"CA","lat":33.9425,"lng":-118.4081,"timezone":"America/Los_Angeles","size":"large_hub","annual_pax":65700000},
  {"iata":"JFK","icao":"KJFK","name":"John F. Kennedy International","city":"New York","state":"NY","lat":40.6413,"lng":-73.7781,"timezone":"America/New_York","size":"large_hub","annual_pax":62500000},
  {"iata":"SFO","icao":"KSFO","name":"San Francisco International","city":"San Francisco","state":"CA","lat":37.6213,"lng":-122.3790,"timezone":"America/Los_Angeles","size":"large_hub","annual_pax":57000000},
  {"iata":"SEA","icao":"KSEA","name":"Seattle-Tacoma International","city":"Seattle","state":"WA","lat":47.4502,"lng":-122.3088,"timezone":"America/Los_Angeles","size":"large_hub","annual_pax":50000000},
  {"iata":"MCO","icao":"KMCO","name":"Orlando International","city":"Orlando","state":"FL","lat":28.4312,"lng":-81.3081,"timezone":"America/New_York","size":"large_hub","annual_pax":49900000},
  {"iata":"EWR","icao":"KEWR","name":"Newark Liberty International","city":"Newark","state":"NJ","lat":40.6895,"lng":-74.1745,"timezone":"America/New_York","size":"large_hub","annual_pax":46300000},
  {"iata":"CLT","icao":"KCLT","name":"Charlotte Douglas International","city":"Charlotte","state":"NC","lat":35.2140,"lng":-80.9431,"timezone":"America/New_York","size":"large_hub","annual_pax":45800000},
  {"iata":"PHX","icao":"KPHX","name":"Phoenix Sky Harbor International","city":"Phoenix","state":"AZ","lat":33.4373,"lng":-112.0078,"timezone":"America/Phoenix","size":"large_hub","annual_pax":44600000},
  {"iata":"IAH","icao":"KIAH","name":"George Bush Intercontinental","city":"Houston","state":"TX","lat":29.9902,"lng":-95.3368,"timezone":"America/Chicago","size":"large_hub","annual_pax":43800000},
  {"iata":"MIA","icao":"KMIA","name":"Miami International","city":"Miami","state":"FL","lat":25.7959,"lng":-80.2870,"timezone":"America/New_York","size":"large_hub","annual_pax":42000000},
  {"iata":"LAS","icao":"KLAS","name":"Harry Reid International","city":"Las Vegas","state":"NV","lat":36.0840,"lng":-115.1537,"timezone":"America/Los_Angeles","size":"large_hub","annual_pax":41700000},
  {"iata":"MSP","icao":"KMSP","name":"Minneapolis-Saint Paul International","city":"Minneapolis","state":"MN","lat":44.8848,"lng":-93.2223,"timezone":"America/Chicago","size":"large_hub","annual_pax":39800000},
  {"iata":"BOS","icao":"KBOS","name":"Boston Logan International","city":"Boston","state":"MA","lat":42.3656,"lng":-71.0096,"timezone":"America/New_York","size":"large_hub","annual_pax":39500000},
  {"iata":"DTW","icao":"KDTW","name":"Detroit Metropolitan Wayne County","city":"Detroit","state":"MI","lat":42.2124,"lng":-83.3534,"timezone":"America/New_York","size":"large_hub","annual_pax":36000000},
  {"iata":"FLL","icao":"KFLL","name":"Fort Lauderdale-Hollywood International","city":"Fort Lauderdale","state":"FL","lat":26.0742,"lng":-80.1506,"timezone":"America/New_York","size":"large_hub","annual_pax":35800000},
  {"iata":"PHL","icao":"KPHL","name":"Philadelphia International","city":"Philadelphia","state":"PA","lat":39.8744,"lng":-75.2424,"timezone":"America/New_York","size":"large_hub","annual_pax":33500000},
  {"iata":"LGA","icao":"KLGA","name":"LaGuardia","city":"New York","state":"NY","lat":40.7769,"lng":-73.8740,"timezone":"America/New_York","size":"large_hub","annual_pax":33000000},
  {"iata":"BWI","icao":"KBWI","name":"Baltimore/Washington International","city":"Baltimore","state":"MD","lat":39.1754,"lng":-76.6684,"timezone":"America/New_York","size":"large_hub","annual_pax":27000000},
  {"iata":"SLC","icao":"KSLC","name":"Salt Lake City International","city":"Salt Lake City","state":"UT","lat":40.7899,"lng":-111.9791,"timezone":"America/Denver","size":"large_hub","annual_pax":26500000},
  {"iata":"DCA","icao":"KDCA","name":"Ronald Reagan Washington National","city":"Washington","state":"DC","lat":38.8512,"lng":-77.0402,"timezone":"America/New_York","size":"large_hub","annual_pax":25000000},
  {"iata":"SAN","icao":"KSAN","name":"San Diego International","city":"San Diego","state":"CA","lat":32.7338,"lng":-117.1933,"timezone":"America/Los_Angeles","size":"large_hub","annual_pax":25000000},
  {"iata":"IAD","icao":"KIAD","name":"Washington Dulles International","city":"Washington","state":"DC","lat":38.9531,"lng":-77.4565,"timezone":"America/New_York","size":"large_hub","annual_pax":24000000},
  {"iata":"TPA","icao":"KTPA","name":"Tampa International","city":"Tampa","state":"FL","lat":27.9756,"lng":-82.5333,"timezone":"America/New_York","size":"large_hub","annual_pax":23500000},
  {"iata":"MDW","icao":"KMDW","name":"Chicago Midway International","city":"Chicago","state":"IL","lat":41.7868,"lng":-87.7522,"timezone":"America/Chicago","size":"large_hub","annual_pax":22000000},
  {"iata":"PDX","icao":"KPDX","name":"Portland International","city":"Portland","state":"OR","lat":45.5898,"lng":-122.5951,"timezone":"America/Los_Angeles","size":"large_hub","annual_pax":21000000},
  {"iata":"HNL","icao":"PHNL","name":"Daniel K. Inouye International","city":"Honolulu","state":"HI","lat":21.3187,"lng":-157.9225,"timezone":"Pacific/Honolulu","size":"large_hub","annual_pax":20000000}
]
```

Note: The full file will be expanded to ~400 airports in a follow-up task using FAA NPIAS data. These top 30 are sufficient to build and test the entire stack. We'll add the remaining ~370 airports by fetching from the FAA database.

- [ ] **Step 3: Commit**

```bash
git add scripts/ src/data/
git commit -m "feat: add airport seed data (top 30 hubs) and seed script"
```

---

### Task 8: Next.js App Shell + Tailwind + shadcn/ui

**Files:**
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Create Next.js config**

Create file `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {},
  },
};

export default nextConfig;
```

- [ ] **Step 2: Create Tailwind config**

Create file `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wait: {
          low: "#22c55e",
          moderate: "#eab308",
          high: "#f97316",
          severe: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Create PostCSS config**

Create file `postcss.config.mjs`:

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 4: Create global CSS**

Create file `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-wait-low: #22c55e;
  --color-wait-moderate: #eab308;
  --color-wait-high: #f97316;
  --color-wait-severe: #ef4444;

  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

- [ ] **Step 5: Install shadcn/ui and next-themes**

```bash
npm install next-themes class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 6: Create root layout**

Create file `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreBoard.ai — Live TSA Wait Times",
  description:
    "Real-time TSA security line wait times for every US airport. Check PreBoard before you board.",
  openGraph: {
    title: "PreBoard.ai — Live TSA Wait Times",
    description:
      "Real-time TSA security line wait times for every US airport.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create placeholder home page**

Create file `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight">PreBoard.ai</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
        Real-time TSA security line wait times for every US airport.
      </p>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
        Misery Map coming soon.
      </p>
    </main>
  );
}
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000` — should see the placeholder page with "PreBoard.ai" heading. Verify dark mode works by toggling system preferences.

- [ ] **Step 9: Commit**

```bash
git add next.config.ts tailwind.config.ts postcss.config.mjs src/app/
git commit -m "feat: add Next.js app shell with Tailwind 4, dark mode, root layout"
```

---

### Task 9: Health API Endpoint

**Files:**
- Create: `src/app/api/v1/health/route.ts`
- Create: `tests/api/health.test.ts`

- [ ] **Step 1: Write the health endpoint**

Create file `src/app/api/v1/health/route.ts`:

```typescript
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const health = {
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    services: {
      api: "ok",
      database: "pending",
      feeds: "pending",
    },
  };

  return NextResponse.json(health);
}
```

- [ ] **Step 2: Write test for health endpoint**

Create file `tests/api/health.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/v1/health/route";

describe("GET /api/v1/health", () => {
  it("returns ok status", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(body.timestamp).toBeDefined();
    expect(body.services.api).toBe("ok");
  });
});
```

- [ ] **Step 3: Run test**

```bash
npx vitest run tests/api/health.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ tests/api/
git commit -m "feat: add /api/v1/health endpoint with test"
```

---

### Task 10: Airports API Endpoint

**Files:**
- Create: `src/app/api/v1/airports/route.ts`

- [ ] **Step 1: Create airports list endpoint**

Create file `src/app/api/v1/airports/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAllAirports } from "@/lib/db/d1";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext();
    const airports = await getAllAirports(env.DB);

    return NextResponse.json({
      count: airports.length,
      airports,
    });
  } catch (error) {
    // Fallback for local dev without D1
    return NextResponse.json({
      count: 0,
      airports: [],
      error: "Database not available",
    });
  }
}
```

- [ ] **Step 2: Create airport detail endpoint**

Create file `src/app/api/v1/airports/[code]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirport, getCheckpoints, getCurrentWaits } from "@/lib/db/d1";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { env } = await getCloudflareContext();

    const airport = await getAirport(env.DB, code);
    if (!airport) {
      return NextResponse.json({ error: "Airport not found" }, { status: 404 });
    }

    const [checkpoints, currentWaits] = await Promise.all([
      getCheckpoints(env.DB, code),
      getCurrentWaits(env.DB, code),
    ]);

    return NextResponse.json({
      airport,
      checkpoints,
      current_waits: currentWaits,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch airport data" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create map overview endpoint**

Create file `src/app/api/v1/map/overview/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAirportOverview } from "@/lib/db/d1";

export const runtime = "edge";

export async function GET() {
  try {
    const { env } = await getCloudflareContext();

    // Try KV cache first
    const cached = await env.CACHE.get("map:overview", "json");
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Cache": "HIT" },
      });
    }

    const airports = await getAirportOverview(env.DB);
    const response = {
      count: airports.length,
      airports,
      generated_at: new Date().toISOString(),
    };

    // Cache for 30 seconds
    await env.CACHE.put("map:overview", JSON.stringify(response), {
      expirationTtl: 30,
    });

    return NextResponse.json(response, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    return NextResponse.json({
      count: 0,
      airports: [],
      error: "Database not available",
    });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: add airports API endpoints — list, detail, map overview with KV caching"
```

---

### Task 11: Placeholder Pages (Airport Detail + Report)

**Files:**
- Create: `src/app/airport/[code]/page.tsx`
- Create: `src/app/report/page.tsx`

- [ ] **Step 1: Create airport detail placeholder**

Create file `src/app/airport/[code]/page.tsx`:

```tsx
import type { Metadata } from "next";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `${code.toUpperCase()} — PreBoard.ai`,
    description: `Live TSA wait times at ${code.toUpperCase()} airport.`,
  };
}

export default async function AirportPage({ params }: Props) {
  const { code } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold tracking-tight">
        {code.toUpperCase()}
      </h1>
      <p className="mt-4 text-gray-600 dark:text-gray-400">
        Airport detail view coming soon.
      </p>
      <a
        href="/"
        className="mt-6 text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to Map
      </a>
    </main>
  );
}
```

- [ ] **Step 2: Create report page placeholder**

Create file `src/app/report/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report Wait Time — PreBoard.ai",
  description: "Submit your TSA security wait time to help other travelers.",
};

export default function ReportPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold tracking-tight">Report Wait Time</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-400">
        Report form coming soon.
      </p>
      <a
        href="/"
        className="mt-6 text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to Map
      </a>
    </main>
  );
}
```

- [ ] **Step 3: Verify all routes work**

```bash
npm run dev
```

Visit:
- `http://localhost:3000` — home page
- `http://localhost:3000/airport/ATL` — airport detail placeholder
- `http://localhost:3000/report` — report placeholder
- `http://localhost:3000/api/v1/health` — health JSON

- [ ] **Step 4: Commit**

```bash
git add src/app/airport/ src/app/report/
git commit -m "feat: add placeholder pages for airport detail and report form"
```

---

### Task 12: Top Nav + Theme Toggle + Footer

**Files:**
- Create: `src/components/layout/top-nav.tsx`
- Create: `src/components/layout/theme-toggle.tsx`
- Create: `src/components/layout/footer.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create theme toggle component**

Create file `src/components/layout/theme-toggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-8" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create top nav**

Create file `src/components/layout/top-nav.tsx`:

```tsx
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            PreBoard<span className="text-blue-600 dark:text-blue-400">.ai</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/report"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Report Wait
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create footer**

Create file `src/components/layout/footer.tsx`:

```tsx
export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-6 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          PreBoard.ai is not affiliated with TSA or any government agency.
          Wait time data may not be accurate. Always allow extra time.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Update root layout to include nav and footer**

Modify `src/app/layout.tsx` — replace the `<body>` content:

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreBoard.ai — Live TSA Wait Times",
  description:
    "Real-time TSA security line wait times for every US airport. Check PreBoard before you board.",
  openGraph: {
    title: "PreBoard.ai — Live TSA Wait Times",
    description:
      "Real-time TSA security line wait times for every US airport.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TopNav />
          <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify UI**

```bash
npm run dev
```

Verify: Nav bar with "PreBoard.ai" logo, "Report Wait" button, theme toggle. Footer with disclaimer. Dark mode toggles correctly.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/ src/app/layout.tsx
git commit -m "feat: add top nav, theme toggle, and footer components"
```

---

### Task 13: Shared UI Components

**Files:**
- Create: `src/components/shared/data-tier-badge.tsx`
- Create: `src/components/shared/color-scale.ts`

- [ ] **Step 1: Create DataTierBadge component**

Create file `src/components/shared/data-tier-badge.tsx`:

```tsx
import type { DataTier } from "@/lib/types/airport";

const tierConfig: Record<DataTier, { label: string; className: string; pulse: boolean }> = {
  live: {
    label: "LIVE",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pulse: true,
  },
  "near-live": {
    label: "~1 min",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    pulse: false,
  },
  predicted: {
    label: "Predicted",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    pulse: false,
  },
  stale: {
    label: "Stale",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    pulse: false,
  },
};

export function DataTierBadge({ tier }: { tier: DataTier }) {
  const config = tierConfig[tier];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {config.label}
    </span>
  );
}
```

- [ ] **Step 2: Create color scale helper**

Create file `src/components/shared/color-scale.ts`:

```typescript
export { getWaitColor, getWaitTailwindClass, getWaitBgClass, getWaitSeverity, WAIT_COLORS } from "@/lib/utils/colors";
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/
git commit -m "feat: add DataTierBadge and color scale shared components"
```

---

### Task 14: Build Verification + Final Commit

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (11 tests across 3 files).

- [ ] **Step 2: Verify build succeeds**

```bash
npm run build
```

Expected: Next.js build completes successfully.

- [ ] **Step 3: Verify local dev server**

```bash
npm run dev
```

Verify all routes work:
- `/` — home with nav + footer
- `/airport/ATL` — placeholder
- `/report` — placeholder
- `/api/v1/health` — JSON response

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: foundation complete — Next.js 15 + Cloudflare D1/KV/DO + seed data + API skeleton"
```

---

## Summary

After completing this plan, you will have:

- Git repo with clean commit history
- Next.js 15 on Cloudflare Pages with full binding config (D1, KV, R2, DO, cron)
- D1 database with complete schema (9 tables, all indexes)
- 30 airports seeded (expandable to 400)
- Core TypeScript types for the entire domain
- Utility functions with 11 passing tests
- REST API endpoints: health, airports list, airport detail, map overview
- App shell with nav, theme toggle, footer, placeholder pages
- Ready for Plan 2 (Data Pipeline) implementation

**Next plans in sequence:**
1. ~~Foundation~~ (this plan)
2. **Data Pipeline** — Feed adapters, ingestion workers, data fusion
3. **Autonomous Feed System** — Discovery, validation, self-healing
4. **Prediction Engine** — Demand model, historical patterns
5. **API Layer** — Full REST + WebSocket realtime
6. **Frontend** — Misery Map, airport detail, report form
