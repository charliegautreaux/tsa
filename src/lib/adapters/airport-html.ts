import type { FeedAdapter, RawReading } from "./base";
import type { FeedConfig, FeedHealth } from "@/lib/types/feed";
import type { LaneType } from "@/lib/types/reading";
import { registerAdapter } from "./registry";

const USER_AGENT =
  "Mozilla/5.0 (compatible; PreBoard.ai/1.0; +https://preboard.ai)";

/** Regex patterns to find wait times in stripped HTML text. */
const WAIT_PATTERNS = [
  /(?:wait|tiempo)[^0-9]*?(\d{1,3})\s*(?:min|minute)/gi,
  /(\d{1,3})\s*(?:min|minute)[^0-9]*?(?:wait|queue|line)/gi,
  /(?:estimated|current|average)[^0-9]*?(\d{1,3})\s*(?:min|minute)/gi,
] as const;

/** Removes HTML tags and normalizes whitespace from raw HTML. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts wait times from plain text using a set of regex patterns.
 * Returns deduplicated readings keyed by checkpoint+lane_type.
 */
function extractWaitTimes(
  text: string,
  config: FeedConfig,
): RawReading[] {
  const seen = new Map<string, RawReading>();
  const checkpoint_id = config.checkpoint_id ?? config.id;

  for (const pattern of WAIT_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const wait_minutes = parseInt(match[1], 10);
      if (isNaN(wait_minutes) || wait_minutes < 0 || wait_minutes > 300) continue;

      // Attempt to identify lane type from surrounding context
      const context = text.slice(Math.max(0, match.index - 40), match.index + match[0].length + 40).toLowerCase();
      let lane_type: LaneType = "standard";
      if (context.includes("precheck") || context.includes("pre-check") || context.includes("tsa pre")) {
        lane_type = "precheck";
      } else if (context.includes("clear")) {
        lane_type = "clear";
      }

      const key = `${checkpoint_id}:${lane_type}`;
      if (!seen.has(key)) {
        seen.set(key, {
          airport_code: config.airport_code,
          checkpoint_id,
          lane_type,
          wait_minutes,
          confidence: 0.5,
          source_type: "airport-api",
          measured_at: new Date().toISOString(),
        });
      }
    }
  }

  return Array.from(seen.values());
}

export const airportHtmlAdapter: FeedAdapter = {
  id: "airport-html",

  async fetch(config: FeedConfig, _env: Record<string, unknown>): Promise<RawReading[]> {
    if (!config.url) return [];

    let html: string;
    try {
      const response = await fetch(config.url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      html = await response.text();
    } catch {
      return [];
    }

    const text = stripHtml(html);
    return extractWaitTimes(text, config);
  },

  async healthCheck(config: FeedConfig, _env: Record<string, unknown>): Promise<FeedHealth> {
    if (!config.url) {
      return { feed_id: config.id, is_healthy: false, response_time_ms: 0, last_error: "No URL configured" };
    }

    const start = Date.now();
    try {
      const response = await fetch(config.url, {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(5_000),
      });
      return {
        feed_id: config.id,
        is_healthy: response.ok,
        response_time_ms: Date.now() - start,
        last_error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        feed_id: config.id,
        is_healthy: false,
        response_time_ms: Date.now() - start,
        last_error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
};

registerAdapter(airportHtmlAdapter);
