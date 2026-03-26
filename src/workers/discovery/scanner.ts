import { PROBE_URL_PATTERNS, PROBE_SCORING, DISCOVERY_THRESHOLDS, AIRPORT_DOMAIN_PATTERNS } from "@/lib/config/discovery.config";
import { getAllAirports, insertFeed, insertDiscoveryLog, getDiscoveryLogForUrl } from "@/lib/db/d1";
import type { Airport } from "@/lib/types/airport";

export interface ProbeResult {
  url: string;
  reachable: boolean;
  score: number;
  contentType: string | null;
  adapterDetected: string | null;
}

/** Score a JSON response for wait-time-like data */
export function scoreResponse(json: unknown): number {
  if (json == null) return 0;
  if (typeof json !== "object") return 0;

  const text = JSON.stringify(json).toLowerCase();
  let score = 0;

  // Check for positive keywords
  for (const keyword of PROBE_SCORING.POSITIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 0.1;
    }
  }

  // Check for numbers in wait time range
  const numbers = text.match(/\d+/g)?.map(Number) || [];
  const validNumbers = numbers.filter(
    (n) => n >= PROBE_SCORING.VALID_WAIT_RANGE.min && n <= PROBE_SCORING.VALID_WAIT_RANGE.max
  );
  if (validNumbers.length > 0) score += 0.2;

  // Check for timestamps (ISO format)
  if (/\d{4}-\d{2}-\d{2}/.test(text)) score += 0.1;

  // Check for array structure (multiple checkpoints)
  if (Array.isArray(json) || Object.values(json as Record<string, unknown>).some(Array.isArray)) {
    score += 0.1;
  }

  // Cap at 1.0
  return Math.min(1.0, score);
}

/** Probe a single URL and score the response */
export async function probeUrl(url: string, airportCode: string): Promise<ProbeResult> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "PreBoard/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return { url, reachable: false, score: 0, contentType: null, adapterDetected: null };
    }

    const contentType = response.headers.get("content-type") || "";
    let score = 0;
    let adapterDetected: string | null = null;

    if (contentType.includes("json")) {
      const json = await response.json();
      score = scoreResponse(json);
      adapterDetected = score > 0.5 ? "dynamic-json" : null;
    } else if (contentType.includes("html")) {
      const html = await response.text();
      const lower = html.toLowerCase();
      const hasWaitContent = PROBE_SCORING.POSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
      score = hasWaitContent ? 0.4 : 0.1;
      adapterDetected = hasWaitContent ? "airport-html" : null;
    }

    return { url, reachable: true, score, contentType, adapterDetected };
  } catch {
    return { url, reachable: false, score: 0, contentType: null, adapterDetected: null };
  }
}

/** Generate candidate URLs for an airport */
function generateProbeUrls(airport: Airport): string[] {
  const urls: string[] = [];
  const code = airport.iata.toLowerCase();
  const city = (airport.city || "").toLowerCase().replace(/\s+/g, "");

  for (const domainPattern of AIRPORT_DOMAIN_PATTERNS) {
    const domain = domainPattern.replace("{code}", code).replace("{city}", city);
    for (const path of PROBE_URL_PATTERNS) {
      urls.push(`https://${domain}${path}`);
    }
  }
  return urls;
}

/** Run a full discovery scan across airports */
export async function runDiscoveryScan(db: D1Database): Promise<{
  airports_scanned: number;
  urls_probed: number;
  feeds_discovered: number;
}> {
  const result = { airports_scanned: 0, urls_probed: 0, feeds_discovered: 0 };
  const airports = await getAllAirports(db);

  const toScan = airports.slice(0, DISCOVERY_THRESHOLDS.MAX_AIRPORTS_PER_RUN);

  for (const airport of toScan) {
    result.airports_scanned++;
    const urls = generateProbeUrls(airport);

    for (const url of urls) {
      const alreadyProbed = await getDiscoveryLogForUrl(db, url);
      if (alreadyProbed) continue;

      result.urls_probed++;
      const probe = await probeUrl(url, airport.iata);

      await insertDiscoveryLog(db, {
        url,
        airport_code: airport.iata,
        discovered_by: "known-pattern",
        probe_score: probe.score,
        adapter_detected: probe.adapterDetected,
        status: probe.score >= DISCOVERY_THRESHOLDS.MIN_PROBE_SCORE ? "trial" : "rejected",
      });

      if (probe.score >= DISCOVERY_THRESHOLDS.MIN_PROBE_SCORE && probe.adapterDetected) {
        const feedId = `${airport.iata.toLowerCase()}-discovered-${Date.now()}`;
        await insertFeed(db, {
          id: feedId,
          airport_code: airport.iata,
          checkpoint_id: null,
          type: "airport-web",
          adapter: probe.adapterDetected,
          url,
          auth_config: JSON.stringify({ type: "none" }),
          polling_interval_sec: 300,
          dynamic_mapping: null,
          status: "trial",
          discovered_by: "known-pattern",
        });
        result.feeds_discovered++;
      }
    }
  }

  return result;
}
