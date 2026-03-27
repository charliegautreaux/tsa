-- Hourly rollup table for long-term trend analysis
-- Raw readings are kept 7 days; rollups are kept indefinitely
CREATE TABLE IF NOT EXISTS readings_rollup (
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

CREATE INDEX IF NOT EXISTS idx_rollup_airport_hour ON readings_rollup(airport_code, hour DESC);
CREATE INDEX IF NOT EXISTS idx_rollup_checkpoint_hour ON readings_rollup(checkpoint_id, hour DESC);
