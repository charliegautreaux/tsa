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
        a.iata, a.name, a.city, a.state, a.lat, a.lng, a.size, a.annual_pax, a.data_tier,
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
  const since = new Date(Date.now() - hoursBack * 3600_000).toISOString().replace("T", " ").slice(0, 19);
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
    .all<Record<string, unknown>>();
  return result.results.map(parseFeedConfig);
}

export async function getFeedsForAirport(db: D1Database, airportCode: string): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE airport_code = ?1 AND status IN ('active', 'trial', 'degraded')")
    .bind(airportCode.toUpperCase())
    .all<Record<string, unknown>>();
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
// FEED MANAGEMENT (for discovery + health)
// ============================================================

export async function insertFeed(db: D1Database, feed: {
  id: string;
  airport_code: string;
  checkpoint_id: string | null;
  type: string;
  adapter: string;
  url: string | null;
  auth_config: string;
  polling_interval_sec: number;
  dynamic_mapping: string | null;
  status: string;
  discovered_by: string;
}): Promise<void> {
  await db
    .prepare(`
      INSERT INTO feeds (id, airport_code, checkpoint_id, type, adapter, url, auth_config, polling_interval_sec, dynamic_mapping, status, discovered_by)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      ON CONFLICT(id) DO NOTHING
    `)
    .bind(feed.id, feed.airport_code, feed.checkpoint_id, feed.type, feed.adapter, feed.url, feed.auth_config, feed.polling_interval_sec, feed.dynamic_mapping, feed.status, feed.discovered_by)
    .run();
}

export async function updateFeedStatus(db: D1Database, feedId: string, status: string): Promise<void> {
  await db
    .prepare("UPDATE feeds SET status = ?2, updated_at = datetime('now') WHERE id = ?1")
    .bind(feedId, status)
    .run();
}

export async function updateFeedReliability(db: D1Database, feedId: string, score: number): Promise<void> {
  await db
    .prepare("UPDATE feeds SET reliability_score = ?2, updated_at = datetime('now') WHERE id = ?1")
    .bind(feedId, score)
    .run();
}

export async function getTrialFeeds(db: D1Database): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE status = 'trial' ORDER BY trial_start_at")
    .all<Record<string, unknown>>();
  return result.results.map(parseFeedConfig);
}

export async function getDegradedFeeds(db: D1Database): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE status = 'degraded' ORDER BY last_error_at")
    .all<Record<string, unknown>>();
  return result.results.map(parseFeedConfig);
}

export async function getInactiveFeeds(db: D1Database): Promise<FeedConfig[]> {
  const result = await db
    .prepare("SELECT * FROM feeds WHERE status IN ('inactive', 'dormant') ORDER BY last_success_at")
    .all<Record<string, unknown>>();
  return result.results.map(parseFeedConfig);
}

export async function getFeedById(db: D1Database, feedId: string): Promise<FeedConfig | null> {
  const row = await db
    .prepare("SELECT * FROM feeds WHERE id = ?1")
    .bind(feedId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return parseFeedConfig(row);
}

export async function getFeedErrorRate(db: D1Database, feedId: string): Promise<{ error_count: number; success_count: number }> {
  const row = await db
    .prepare("SELECT error_count_1h as error_count, success_count_1h as success_count FROM feeds WHERE id = ?1")
    .bind(feedId)
    .first<{ error_count: number; success_count: number }>();
  return row || { error_count: 0, success_count: 0 };
}

// ============================================================
// DISCOVERY LOG
// ============================================================

export async function insertDiscoveryLog(db: D1Database, entry: {
  url: string;
  airport_code: string | null;
  discovered_by: string;
  probe_score: number | null;
  adapter_detected: string | null;
  status: string;
}): Promise<void> {
  await db
    .prepare(`
      INSERT INTO discovery_log (url, airport_code, discovered_by, probe_score, adapter_detected, status)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `)
    .bind(entry.url, entry.airport_code, entry.discovered_by, entry.probe_score, entry.adapter_detected, entry.status)
    .run();
}

export async function getDiscoveryLogForUrl(db: D1Database, url: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM discovery_log WHERE url = ?1 LIMIT 1")
    .bind(url)
    .first();
  return row !== null;
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
  const since = new Date(Date.now() - minutesBack * 60_000).toISOString().replace("T", " ").slice(0, 19);
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

// ============================================================
// SPARKLINE DATA (for trend charts)
// ============================================================

export async function getSparklineData(db: D1Database, hoursBack: number = 6): Promise<{
  airport_code: string;
  wait_minutes: number;
  bucket: string;
}[]> {
  const since = new Date(Date.now() - hoursBack * 3600_000)
    .toISOString().replace("T", " ").slice(0, 19);
  const result = await db
    .prepare(`
      SELECT
        airport_code,
        ROUND(MAX(wait_minutes), 1) as wait_minutes,
        substr(measured_at, 1, 14) || CASE
          WHEN CAST(substr(measured_at, 15, 2) AS INTEGER) < 30 THEN '00'
          ELSE '30'
        END as bucket
      FROM readings
      WHERE measured_at > ?1 AND source_type != 'predicted' AND lane_type = 'standard'
      GROUP BY airport_code,
        substr(measured_at, 1, 14) || CASE
          WHEN CAST(substr(measured_at, 15, 2) AS INTEGER) < 30 THEN '00'
          ELSE '30'
        END
      ORDER BY airport_code, bucket
    `)
    .bind(since)
    .all();
  return result.results as any[];
}

// ============================================================
// ROLLUP QUERIES (long-term historical data)
// ============================================================

export async function getRollupData(
  db: D1Database,
  airportCode: string,
  daysBack: number = 30,
  checkpointId?: string
): Promise<{
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  hour: string;
  avg_wait: number;
  min_wait: number;
  max_wait: number;
  sample_count: number;
}[]> {
  const since = new Date(Date.now() - daysBack * 24 * 3600_000)
    .toISOString().replace("T", " ").slice(0, 19);

  if (checkpointId) {
    const result = await db
      .prepare(`
        SELECT airport_code, checkpoint_id, lane_type, hour, avg_wait, min_wait, max_wait, sample_count
        FROM readings_rollup
        WHERE airport_code = ?1 AND checkpoint_id = ?2 AND hour > ?3
        ORDER BY hour ASC
      `)
      .bind(airportCode.toUpperCase(), checkpointId, since)
      .all();
    return result.results as any[];
  }

  const result = await db
    .prepare(`
      SELECT airport_code, checkpoint_id, lane_type, hour, avg_wait, min_wait, max_wait, sample_count
      FROM readings_rollup
      WHERE airport_code = ?1 AND hour > ?2
      ORDER BY hour ASC
    `)
    .bind(airportCode.toUpperCase(), since)
    .all();
  return result.results as any[];
}

export async function getAirportRollupSummary(
  db: D1Database,
  airportCode: string,
  daysBack: number = 30
): Promise<{
  lane_type: string;
  avg_wait: number;
  min_wait: number;
  max_wait: number;
  total_samples: number;
  hours_with_data: number;
}[]> {
  const since = new Date(Date.now() - daysBack * 24 * 3600_000)
    .toISOString().replace("T", " ").slice(0, 19);
  const result = await db
    .prepare(`
      SELECT
        lane_type,
        ROUND(AVG(avg_wait), 1) as avg_wait,
        ROUND(MIN(min_wait), 1) as min_wait,
        ROUND(MAX(max_wait), 1) as max_wait,
        SUM(sample_count) as total_samples,
        COUNT(*) as hours_with_data
      FROM readings_rollup
      WHERE airport_code = ?1 AND hour > ?2
      GROUP BY lane_type
    `)
    .bind(airportCode.toUpperCase(), since)
    .all();
  return result.results as any[];
}

// ============================================================
// MAP + STATS QUERIES
// ============================================================

export async function getWorstAirports(db: D1Database, limit: number = 10): Promise<{
  airport_code: string;
  name: string;
  city: string;
  state: string;
  worst_wait: number;
  lane_type: string;
  data_tier: string;
}[]> {
  const result = await db
    .prepare(`
      SELECT cw.airport_code, a.name, a.city, a.state,
             MAX(cw.wait_minutes) as worst_wait, cw.lane_type, a.data_tier
      FROM current_waits cw
      JOIN airports a ON cw.airport_code = a.iata
      WHERE cw.lane_type = 'standard'
      GROUP BY cw.airport_code
      ORDER BY worst_wait DESC
      LIMIT ?1
    `)
    .bind(limit)
    .all();
  return result.results as any[];
}

export async function getNationalStats(db: D1Database): Promise<{
  total_airports: number;
  airports_with_data: number;
  avg_wait_standard: number;
  avg_wait_precheck: number;
  worst_airport_code: string | null;
  worst_wait: number;
  tier_breakdown: { tier: string; count: number }[];
}> {
  const [totalRow, withDataRow, avgStdRow, avgPreRow, worstRow, tierRows] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM airports WHERE status = 'active'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(DISTINCT airport_code) as count FROM current_waits").first<{ count: number }>(),
    db.prepare("SELECT AVG(wait_minutes) as avg FROM current_waits WHERE lane_type = 'standard'").first<{ avg: number }>(),
    db.prepare("SELECT AVG(wait_minutes) as avg FROM current_waits WHERE lane_type = 'precheck'").first<{ avg: number }>(),
    db.prepare("SELECT airport_code, MAX(wait_minutes) as wait FROM current_waits WHERE lane_type = 'standard'").first<{ airport_code: string; wait: number }>(),
    db.prepare("SELECT data_tier as tier, COUNT(*) as count FROM airports WHERE status = 'active' GROUP BY data_tier").all<{ tier: string; count: number }>(),
  ]);

  return {
    total_airports: totalRow?.count ?? 0,
    airports_with_data: withDataRow?.count ?? 0,
    avg_wait_standard: Math.round((avgStdRow?.avg ?? 0) * 10) / 10,
    avg_wait_precheck: Math.round((avgPreRow?.avg ?? 0) * 10) / 10,
    worst_airport_code: worstRow?.airport_code ?? null,
    worst_wait: worstRow?.wait ?? 0,
    tier_breakdown: tierRows.results,
  };
}

// ============================================================
// HOURLY AVERAGES (for guide pages)
// ============================================================

export interface HourlyAverage {
  hour: number;
  avg_wait: number;
  sample_count: number;
}

export async function getHourlyAverages(
  db: D1Database,
  airportCode: string
): Promise<HourlyAverage[]> {
  const result = await db
    .prepare(`
      SELECT
        CAST(strftime('%H', hour) AS INTEGER) as hour,
        ROUND(AVG(avg_wait), 1) as avg_wait,
        SUM(sample_count) as sample_count
      FROM readings_rollup
      WHERE airport_code = ?1
      GROUP BY CAST(strftime('%H', hour) AS INTEGER)
      ORDER BY hour
    `)
    .bind(airportCode.toUpperCase())
    .all<HourlyAverage>();
  return result.results;
}
