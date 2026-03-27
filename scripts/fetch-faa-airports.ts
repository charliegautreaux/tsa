/**
 * Fetches FAA airport master data and writes expanded airports-seed.json.
 *
 * Usage:
 *   npx tsx scripts/fetch-faa-airports.ts
 *
 * Data sources:
 *   - FAA Airport Facilities (public domain)
 *
 * Exports parse/filter functions for testing.
 */

import fs from "fs";
import path from "path";

// ---------- types ----------

interface SeedAirport {
  iata: string;
  icao: string | null;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  timezone: string;
  size: "large_hub" | "medium_hub" | "small_hub" | "nonhub" | "unknown";
  annual_pax: number;
}

interface TzBox {
  tz: string;
  w: number;
  s: number;
  e: number;
  n: number;
}

// ---------- constants ----------

const SEED_PATH = path.join(__dirname, "../src/data/airports-seed.json");
const TZ_PATH = path.join(__dirname, "../src/data/tz-lookup.json");

// FAA NPIAS enplanement data URL — update annually when new CY data is published.
// If this URL returns 404, the script falls back to existing seed data.
// Manual refresh: run `npx tsx scripts/generate-seed-data.ts` to regenerate from embedded data.
const FAA_URL =
  "https://www.faa.gov/airports/planning_capacity/npias/current/media/NPIAS-Enplanements.csv";

const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY","PR","GU","VI","AS","MP",
]);

// ---------- exported utilities ----------

export function mapHubSize(code: string | undefined): SeedAirport["size"] {
  switch (code?.toUpperCase()) {
    case "L": return "large_hub";
    case "M": return "medium_hub";
    case "S": return "small_hub";
    case "N": return "nonhub";
    default: return "unknown";
  }
}

let tzBoxes: TzBox[] | null = null;
function loadTzBoxes(): TzBox[] {
  if (!tzBoxes) {
    tzBoxes = JSON.parse(fs.readFileSync(TZ_PATH, "utf-8"));
  }
  return tzBoxes!;
}

export function lookupTimezone(lat: number, lng: number): string {
  const boxes = loadTzBoxes();
  for (const box of boxes) {
    if (lat >= box.s && lat <= box.n && lng >= box.w && lng <= box.e) {
      return box.tz;
    }
  }
  return "America/New_York";
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bIntl\b/gi, "Intl")
    .replace(/\bAfb\b/gi, "AFB")
    .replace(/\bArb\b/gi, "ARB");
}

export function parseFaaRecord(
  row: Record<string, string>
): SeedAirport | null {
  const facilityType = (row.FacilityType || "").trim().toUpperCase();
  if (facilityType !== "AIRPORT") return null;

  const iata = (row.LocationID || "").trim().toUpperCase();
  if (!iata || iata.length !== 3 || !/^[A-Z]{3}$/.test(iata)) return null;

  const state = (row.State || "").trim().toUpperCase();
  if (!VALID_STATES.has(state)) return null;

  const lat = parseFloat(row.Latitude);
  const lng = parseFloat(row.Longitude);
  if (isNaN(lat) || isNaN(lng)) return null;

  const icao = (row.ICAOIdentifier || "").trim().toUpperCase() || null;
  const name = titleCase((row.FacilityName || iata).trim());
  const city = titleCase((row.City || "").trim());
  const hubSize = mapHubSize((row.HubSize || "").trim());
  const enplanements = parseInt(row.Enplanements || "0", 10) || 0;

  return {
    iata,
    icao: icao && icao.length === 4 ? icao : `K${iata}`,
    name,
    city,
    state,
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
    timezone: lookupTimezone(lat, lng),
    size: hubSize,
    annual_pax: enplanements * 2,
  };
}

export function filterCommercial(airports: SeedAirport[]): SeedAirport[] {
  return airports.filter(
    (a) => a.annual_pax > 0 || a.size !== "unknown"
  );
}

// ---------- CSV parser ----------

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

// ---------- main ----------

async function main() {
  console.log("Fetching FAA airport data...");

  let csvText: string;
  try {
    const resp = await fetch(FAA_URL, {
      headers: { "User-Agent": "PreBoard/1.0 airport-seed-updater" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    csvText = await resp.text();
  } catch (err) {
    console.error("Failed to fetch FAA data:", err);
    console.log("Falling back to existing seed file (no changes).");
    process.exit(0);
  }

  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length} FAA records`);

  const parsed = rows
    .map(parseFaaRecord)
    .filter((a): a is SeedAirport => a !== null);
  console.log(`${parsed.length} valid airports after parsing`);

  const commercial = filterCommercial(parsed);
  console.log(`${commercial.length} commercial service airports`);

  const byIata = new Map<string, SeedAirport>();
  for (const a of commercial) {
    const existing = byIata.get(a.iata);
    if (!existing || a.annual_pax > existing.annual_pax) {
      byIata.set(a.iata, a);
    }
  }

  const final = Array.from(byIata.values()).sort(
    (a, b) => b.annual_pax - a.annual_pax
  );

  fs.writeFileSync(SEED_PATH, JSON.stringify(final, null, 2) + "\n");
  console.log(`Wrote ${final.length} airports to ${SEED_PATH}`);
}

if (require.main === module) {
  main().catch(console.error);
}
