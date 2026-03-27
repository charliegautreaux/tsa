export type FeedType =
  | "sensor-api"
  | "airport-web"
  | "government"
  | "flight-data"
  | "crowdsourced"
  | "derived";

export type FeedStatus =
  | "pending"
  | "trial"
  | "active"
  | "degraded"
  | "inactive"
  | "dormant"
  | "dead";

export type AdapterType =
  | "bliptrack"
  | "xovis"
  | "airport-json"
  | "airport-html"
  | "dynamic-json"
  | "faa-swim"
  | "flightaware"
  | "noaa"
  | "tsa-throughput"
  | "crowdsource"
  | "traytable";

export type DiscoveryMethod =
  | "known-pattern"
  | "sitemap-crawl"
  | "faa-sync"
  | "community"
  | "manual";

export interface FeedConfig {
  id: string;
  airport_code: string;
  checkpoint_id: string | null;
  type: FeedType;
  adapter: AdapterType;
  url: string | null;
  auth_config: { type: "none" } | { type: "api-key"; key: string; header: string } | { type: "bearer"; token: string };
  polling_interval_sec: number;
  dynamic_mapping: Record<string, string> | null;
  status: FeedStatus;
  reliability_score: number;
  discovered_by: DiscoveryMethod;
}

export interface FeedHealth {
  feed_id: string;
  is_healthy: boolean;
  response_time_ms: number;
  last_error: string | null;
}
