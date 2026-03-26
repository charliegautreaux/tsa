export interface Prediction {
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  predicted_wait: number;
  confidence: number;
  trend: "rising" | "falling" | "stable";
  data_sources: string[];
  generated_at: string;
}

export interface ForecastPoint {
  time: string;
  predicted_wait: number;
  confidence: number;
}

export interface Forecast {
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  points: ForecastPoint[];
  best_time: {
    start: string;
    end: string;
    predicted_wait: number;
  } | null;
}

export interface HistoricalPattern {
  airport_code: string;
  checkpoint_id: string;
  lane_type: string;
  day_of_week: number;
  hour: number;
  avg_wait: number;
  sample_count: number;
}

export interface WeatherImpact {
  airport_code: string;
  condition: string;
  impact_factor: number;
  fetched_at: string;
}
