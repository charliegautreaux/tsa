export type LaneType = "standard" | "precheck" | "clear" | "unknown";

export type SourceType = "sensor" | "airport-api" | "crowdsourced" | "predicted";

export type Trend = "rising" | "falling" | "stable";

export interface NormalizedReading {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  wait_minutes: number;
  confidence: number;
  source_type: SourceType;
  measured_at: string;
  ingested_at: string;
}

export interface CurrentWait {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  wait_minutes: number;
  confidence: number;
  trend: Trend;
  source_type: SourceType;
  data_tier: string;
  updated_at: string;
}
