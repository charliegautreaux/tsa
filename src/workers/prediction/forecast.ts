import type { HistoricalPattern, WeatherImpact, ForecastPoint } from "@/lib/types/prediction";
import { calculatePrediction } from "./predictor";

const FORECAST_HOURS = 4;
const INTERVAL_MINUTES = 15;
const POINTS_COUNT = (FORECAST_HOURS * 60) / INTERVAL_MINUTES; // 16

interface ForecastInput {
  checkpointId: string;
  laneType: string;
  patterns: HistoricalPattern[];
  weather: WeatherImpact;
  now: Date;
  hasDisruption: boolean;
}

/** Generate 4-hour forecast in 15-minute intervals */
export function generateForecast(input: ForecastInput): ForecastPoint[] {
  const points: ForecastPoint[] = [];

  for (let i = 0; i < POINTS_COUNT; i++) {
    const forecastTime = new Date(input.now.getTime() + i * INTERVAL_MINUTES * 60_000);
    const hour = forecastTime.getUTCHours() + forecastTime.getUTCMinutes() / 60;
    const forecastDay = forecastTime.getUTCDay();

    const result = calculatePrediction({
      checkpointId: input.checkpointId,
      laneType: input.laneType,
      patterns: input.patterns,
      weather: input.weather,
      dayOfWeek: forecastDay,
      hour,
      crowdAvg: null,
      hasDisruption: input.hasDisruption,
    });

    // Confidence decays further into the future
    const decayFactor = 1 - (i / POINTS_COUNT) * 0.3;

    points.push({
      time: forecastTime.toISOString(),
      predicted_wait: result.predicted_wait,
      confidence: Math.round(result.confidence * decayFactor * 100) / 100,
    });
  }

  return points;
}

/** Find the best time window (lowest predicted wait) */
export function findBestTime(points: ForecastPoint[]): {
  start: string;
  end: string;
  predicted_wait: number;
} | null {
  if (points.length === 0) return null;

  let bestIdx = 0;
  let bestWait = points[0].predicted_wait;

  for (let i = 1; i < points.length; i++) {
    if (points[i].predicted_wait < bestWait) {
      bestWait = points[i].predicted_wait;
      bestIdx = i;
    }
  }

  // Extend the window to include adjacent similar-wait points
  let startIdx = bestIdx;
  let endIdx = bestIdx;
  const threshold = bestWait * 1.4;

  while (startIdx > 0 && points[startIdx - 1].predicted_wait <= threshold) startIdx--;
  while (endIdx < points.length - 1 && points[endIdx + 1].predicted_wait <= threshold) endIdx++;

  return {
    start: points[startIdx].time,
    end: points[endIdx].time,
    predicted_wait: Math.round(bestWait * 10) / 10,
  };
}
