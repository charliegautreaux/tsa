import type { RawReading } from "@/lib/adapters/base";
import { validateReading, toNormalized } from "@/lib/adapters/base";
import { fuseReadings } from "./fusion";
import { calculateTrend } from "@/lib/utils/trend";
import { upsertCurrentWait, insertReading } from "@/lib/db/d1";
import { cacheCurrentWaits } from "@/lib/db/kv";
import type { CurrentWait } from "@/lib/types/reading";

interface ProcessResult {
  processed: number;
  rejected: number;
  errors: string[];
}

export async function processReadings(
  rawReadings: RawReading[],
  db: D1Database,
  kv: KVNamespace
): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, rejected: 0, errors: [] };

  // Step 1: Validate
  const valid: RawReading[] = [];
  for (const reading of rawReadings) {
    if (validateReading(reading)) {
      valid.push(reading);
    } else {
      result.rejected++;
    }
  }
  if (valid.length === 0) return result;

  // Step 2: Fuse
  const fused = fuseReadings(valid);

  // Step 3-5: Process each fused reading
  const currentWaits: CurrentWait[] = [];

  for (const reading of fused) {
    try {
      // Insert into readings table
      const normalized = toNormalized(reading);
      await insertReading(db, normalized);

      // Get recent readings for trend
      const recentResult = await db
        .prepare(
          `SELECT wait_minutes FROM readings
           WHERE checkpoint_id = ?1 AND lane_type = ?2
           ORDER BY measured_at DESC LIMIT 10`
        )
        .bind(reading.checkpoint_id, reading.lane_type)
        .all<{ wait_minutes: number }>();

      const recentValues = recentResult.results.map((r) => r.wait_minutes);
      const trend = calculateTrend(recentValues);

      // Determine data tier
      const dataTier =
        reading.source_type === "sensor"
          ? "live"
          : reading.source_type === "airport-api"
            ? "near-live"
            : reading.source_type === "crowdsourced"
              ? "near-live"
              : "predicted";

      const currentWait: CurrentWait = {
        airport_code: reading.airport_code,
        checkpoint_id: reading.checkpoint_id,
        lane_type: reading.lane_type,
        wait_minutes: reading.wait_minutes,
        confidence: reading.confidence,
        trend,
        source_type: reading.source_type,
        data_tier: dataTier,
        updated_at: new Date().toISOString(),
      };
      await upsertCurrentWait(db, currentWait);
      currentWaits.push(currentWait);
      result.processed++;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // Update KV cache
  if (currentWaits.length > 0) {
    const airportCode = currentWaits[0].airport_code;
    try {
      await cacheCurrentWaits(kv, airportCode, currentWaits);
    } catch {
      // KV cache failures are non-fatal
    }
  }

  return result;
}
