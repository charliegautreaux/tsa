import type { Trend } from "./reading";

export type AirportSize =
  | "large_hub"
  | "medium_hub"
  | "small_hub"
  | "nonhub"
  | "unknown";

export type DataTier = "live" | "near-live" | "predicted" | "stale";

export type CheckpointStatus = "open" | "closed" | "unknown";

export interface Airport {
  iata: string;
  icao: string | null;
  name: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  timezone: string;
  size: AirportSize;
  annual_pax: number;
  data_tier: DataTier;
  status: "active" | "inactive";
}

export interface Checkpoint {
  id: string;
  airport_code: string;
  name: string;
  terminal: string | null;
  has_standard: boolean;
  has_precheck: boolean;
  has_clear: boolean;
  status: CheckpointStatus;
  reopens_at: string | null;
}

export interface AirportOverview {
  iata: string;
  name: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  data_tier: DataTier;
  worst_wait: number | null;
  worst_trend: Trend | null;
}
