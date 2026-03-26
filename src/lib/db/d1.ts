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
