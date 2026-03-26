import type { NormalizedReading, LaneType, SourceType } from "@/lib/types/reading";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";

export interface RawReading {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  wait_minutes: number;
  confidence: number;
  source_type: SourceType;
  measured_at: string;
}

export interface FeedAdapter {
  id: string;
  fetch(config: FeedConfig, env: Record<string, unknown>): Promise<RawReading[]>;
  healthCheck(config: FeedConfig, env: Record<string, unknown>): Promise<FeedHealth>;
}

export function createRawReading(partial: Partial<RawReading> & {
  airport_code: string;
  checkpoint_id: string;
  lane_type: LaneType;
  wait_minutes: number;
  confidence: number;
  source_type: SourceType;
  measured_at: string;
}): RawReading {
  return { ...partial };
}

export function validateReading(reading: RawReading): boolean {
  if (!reading.airport_code || reading.airport_code.length < 2) return false;
  if (!reading.checkpoint_id) return false;
  if (reading.wait_minutes < 0 || reading.wait_minutes > 300) return false;
  if (reading.confidence < 0 || reading.confidence > 1) return false;
  if (!reading.measured_at) return false;
  return true;
}

export function toNormalized(raw: RawReading): NormalizedReading {
  return {
    ...raw,
    ingested_at: new Date().toISOString(),
  };
}
