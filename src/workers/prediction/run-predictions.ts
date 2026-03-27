import { getAllAirports, getHistoricalAverages, getRecentCrowdAverage, getCheckpoints, upsertPrediction, upsertCurrentWait } from "@/lib/db/d1";
import { getWeatherImpact } from "./weather";
import { calculatePrediction } from "./predictor";
import { generateForecast, findBestTime } from "./forecast";
import type { HistoricalPattern } from "@/lib/types/prediction";

const LANE_TYPES = ["standard", "precheck", "clear"] as const;

export async function runPredictions(db: D1Database, maxAirports = 5): Promise<{
  airports_processed: number;
  predictions_generated: number;
}> {
  const result = { airports_processed: 0, predictions_generated: 0 };
  const allAirports = await getAllAirports(db);
  const now = new Date();

  // Process a rotating subset to stay within D1 subrequest limits
  const offset = now.getMinutes() % Math.ceil(allAirports.length / maxAirports);
  const airports = allAirports
    .filter((a) => a.data_tier !== "live")
    .slice(offset * maxAirports, offset * maxAirports + maxAirports);

  for (const airport of airports) {

    result.airports_processed++;

    const checkpoints = await getCheckpoints(db, airport.iata);
    if (checkpoints.length === 0) continue;

    const historicalRows = await getHistoricalAverages(db, airport.iata);
    const patterns: HistoricalPattern[] = historicalRows.map((r) => ({
      airport_code: airport.iata,
      checkpoint_id: r.checkpoint_id,
      lane_type: r.lane_type,
      day_of_week: r.day_of_week,
      hour: r.hour,
      avg_wait: r.avg_wait,
      sample_count: r.sample_count,
    }));

    const weather = await getWeatherImpact(airport.iata);

    const crowdAvgs = await getRecentCrowdAverage(db, airport.iata);
    const crowdMap = new Map(
      crowdAvgs.map((c) => [`${c.checkpoint}:${c.lane_type}`, c.avg_wait])
    );

    const dayOfWeek = now.getUTCDay();
    const hour = now.getUTCHours() + now.getUTCMinutes() / 60;

    for (const checkpoint of checkpoints) {
      for (const laneType of LANE_TYPES) {
        const crowdKey = `${checkpoint.id}:${laneType}`;
        const crowdAvg = crowdMap.get(crowdKey) ?? null;

        const pred = calculatePrediction({
          checkpointId: checkpoint.id,
          laneType,
          patterns,
          weather,
          dayOfWeek,
          hour,
          crowdAvg,
          hasDisruption: false,
        });

        await upsertCurrentWait(db, {
          airport_code: airport.iata,
          checkpoint_id: checkpoint.id,
          lane_type: laneType,
          wait_minutes: pred.predicted_wait,
          confidence: pred.confidence,
          trend: "stable",
          source_type: "predicted",
          data_tier: "predicted",
          updated_at: now.toISOString(),
        });

        const forecastPoints = generateForecast({
          checkpointId: checkpoint.id,
          laneType,
          patterns,
          weather,
          now,
          hasDisruption: false,
        });

        for (const point of forecastPoints) {
          await upsertPrediction(db, {
            airport_code: airport.iata,
            checkpoint_id: checkpoint.id,
            lane_type: laneType,
            forecast_time: point.time,
            predicted_wait: point.predicted_wait,
            confidence: point.confidence,
          });
          result.predictions_generated++;
        }
      }
    }
  }

  return result;
}
