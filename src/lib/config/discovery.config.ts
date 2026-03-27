// src/lib/config/discovery.config.ts

/** URL patterns to probe on airport domains */
export const PROBE_URL_PATTERNS = [
  "/api/wait-times",
  "/api/security/wait-times",
  "/api/v1/security",
  "/api/tsa",
  "/api/checkpoint",
  "/security/wait-times",
  "/tsa/wait-times.json",
  "/data/security.json",
  "/feeds/security",
  "/api/security-wait",
  "/_api/security",
  "/api/passenger/wait-times",
  "/services/security/times",
  "/waittimes",
  "/wait-times.json",
  "/security-status.json",
  "/api/status/security",
  "/checkpoint/status",
  "/api/queue/times",
  "/real-time/security",
  "/api/security-lines",
  "/passenger-info/wait-times",
  "/tsa-info",
  "/api/v2/security",
  "/flight-info/security",
];

/** Common airport domain patterns */
export const AIRPORT_DOMAIN_PATTERNS = [
  "fly{code}.com",
  "{code}airport.com",
  "{code}.aero",
  "www.fly{code}.com",
  "{city}airport.com",
  "{code}-airport.com",
  "{code}.airport-authority.com",
  "www.{city}airport.org",
  "airport.{city}.gov",
  "{code}intl.com",
  "www.{code}airport.com",
];

/** Sitemap keywords that suggest wait time content */
export const SITEMAP_KEYWORDS = [
  "wait", "security", "queue", "checkpoint", "tsa", "screening", "line",
];

/** Discovery scoring thresholds */
export const DISCOVERY_THRESHOLDS = {
  /** Minimum probe score to consider a feed valid (0-1) */
  MIN_PROBE_SCORE: 0.7,
  /** Minimum reliability score after 24h trial to auto-activate */
  MIN_RELIABILITY_SCORE: 0.75,
  /** Number of trial polls before evaluation */
  TRIAL_POLL_COUNT: 288, // 24h at 5min intervals
  /** Max number of airports to scan per discovery run */
  MAX_AIRPORTS_PER_RUN: 100,
  /** Max concurrent probes per run */
  MAX_CONCURRENT_PROBES: 5,
  /** Max concurrent probes per domain */
  MAX_CONCURRENT_PER_DOMAIN: 2,
};

/** Wait time scoring heuristics for probe responses */
export const PROBE_SCORING = {
  /** Keywords that boost score */
  POSITIVE_KEYWORDS: ["wait", "time", "minute", "queue", "checkpoint", "security", "lane", "precheck", "clear"],
  /** Number ranges typical of wait times (minutes) */
  VALID_WAIT_RANGE: { min: 0, max: 180 },
  /** Minimum fields to consider valid */
  MIN_FIELDS: 2,
};
