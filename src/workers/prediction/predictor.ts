import type { HistoricalPattern, WeatherImpact } from "@/lib/types/prediction";
import { getBaseWait, getDayFactor, getHourFactor, DEFAULT_WAIT_MINUTES } from "./historical";

const MAX_WAIT = 180;
const CROWD_WEIGHT = 0.3;
const DISRUPTION_MULTIPLIER = 1.25;

/** Clamp wait time to valid range and round */
export function clampWait(wait: number): number {
  return Math.round(Math.max(0, Math.min(MAX_WAIT, wait)) * 10) / 10;
}

interface PredictionInput {
  checkpointId: string;
  laneType: string;
  patterns: HistoricalPattern[];
  weather: WeatherImpact;
  dayOfWeek: number;
  hour: number;
  crowdAvg: number | null;
  hasDisruption: boolean;
}

/** Calculate predicted wait from all available signals */
export function calculatePrediction(input: PredictionInput): {
  predicted_wait: number;
  confidence: number;
  data_sources: string[];
} {
  const dataSources: string[] = [];

  // 1. Historical base wait
  let baseWait = getBaseWait(input.patterns, input.checkpointId, input.laneType, input.dayOfWeek, Math.floor(input.hour));
  const hasHistory = baseWait !== DEFAULT_WAIT_MINUTES;
  if (hasHistory) {
    dataSources.push("historical");
  } else {
    baseWait = DEFAULT_WAIT_MINUTES * getDayFactor(input.dayOfWeek) * getHourFactor(input.hour);
    dataSources.push("default-model");
  }

  // 2. Weather adjustment
  let wait = baseWait * input.weather.impact_factor;
  if (input.weather.impact_factor !== 1.0) {
    dataSources.push("weather");
  }

  // 3. Disruption adjustment
  if (input.hasDisruption) {
    wait *= DISRUPTION_MULTIPLIER;
    dataSources.push("faa-disruption");
  }

  // 4. Crowd correction
  if (input.crowdAvg !== null) {
    wait = wait * (1 - CROWD_WEIGHT) + input.crowdAvg * CROWD_WEIGHT;
    dataSources.push("crowdsourced");
  }

  // Confidence based on data richness
  let confidence = 0.4;
  if (hasHistory) confidence += 0.15;
  if (input.crowdAvg !== null) confidence += 0.1;
  if (input.weather.condition !== "unknown") confidence += 0.05;
  confidence = Math.min(0.65, confidence);

  return {
    predicted_wait: clampWait(wait),
    confidence: Math.round(confidence * 100) / 100,
    data_sources: dataSources,
  };
}
