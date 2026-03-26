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
