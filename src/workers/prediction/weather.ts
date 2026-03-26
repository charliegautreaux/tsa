import type { WeatherImpact } from "@/lib/types/prediction";

const NOAA_OBS_BASE = "https://api.weather.gov/stations/K";

/** Map weather condition text to impact multiplier */
export function conditionToFactor(condition: string): number {
  const lower = condition.toLowerCase();

  if (lower.includes("thunderstorm") || lower.includes("tornado")) return 1.4;
  if (lower.includes("blizzard") || lower.includes("ice storm")) return 1.5;
  if (lower.includes("snow") || lower.includes("freezing")) return 1.35;
  if (lower.includes("sleet") || lower.includes("ice")) return 1.3;
  if (lower.includes("heavy rain")) return 1.2;
  if (lower.includes("rain") || lower.includes("drizzle")) return 1.1;
  if (lower.includes("fog") || lower.includes("mist")) return 1.15;
  if (lower.includes("wind")) return 1.1;
  if (lower.includes("clear") || lower.includes("sunny") || lower.includes("fair")) return 1.0;
  if (lower.includes("cloud") || lower.includes("overcast")) return 1.0;

  return 1.0;
}

/** Fetch current weather condition from NOAA for an airport */
export async function getWeatherImpact(airportCode: string): Promise<WeatherImpact> {
  try {
    const url = `${NOAA_OBS_BASE}${airportCode}/observations/latest`;
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "PreBoard.ai/1.0 (preboard.ai)",
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return { airport_code: airportCode, condition: "unknown", impact_factor: 1.0, fetched_at: new Date().toISOString() };
    }

    const data = await response.json() as { properties?: { textDescription?: string } };
    const condition = data?.properties?.textDescription ?? "unknown";

    return {
      airport_code: airportCode,
      condition,
      impact_factor: conditionToFactor(condition),
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return { airport_code: airportCode, condition: "unknown", impact_factor: 1.0, fetched_at: new Date().toISOString() };
  }
}
