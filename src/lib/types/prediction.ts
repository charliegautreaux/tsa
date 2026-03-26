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
