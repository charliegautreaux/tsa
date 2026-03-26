/**
 * Seeds the D1 database with all US commercial airports from FAA data.
 * Usage:
 *   npx tsx scripts/seed-airports.ts --local   (local D1)
 *   npx tsx scripts/seed-airports.ts --remote  (remote D1)
 */

import { execSync } from "child_process";
import airports from "../src/data/airports-seed.json";

const isRemote = process.argv.includes("--remote");
const flag = isRemote ? "--remote" : "--local";

console.log(`Seeding ${airports.length} airports (${flag})...`);

// D1 has a batch limit, so we chunk into groups of 50
const CHUNK_SIZE = 50;

for (let i = 0; i < airports.length; i += CHUNK_SIZE) {
  const chunk = airports.slice(i, i + CHUNK_SIZE);
  const values = chunk
    .map(
      (a) =>
        `('${a.iata}', ${a.icao ? `'${a.icao}'` : "NULL"}, '${a.name.replace(/'/g, "''")}', '${(a.city || "").replace(/'/g, "''")}', '${a.state}', ${a.lat}, ${a.lng}, '${a.timezone}', '${a.size}', ${a.annual_pax}, 'predicted', 'active')`
    )
    .join(",\n    ");

  const sql = `INSERT OR IGNORE INTO airports (iata, icao, name, city, state, lat, lng, timezone, size, annual_pax, data_tier, status) VALUES\n    ${values};`;

  execSync(
    `npx wrangler d1 execute preboard-db ${flag} --command "${sql.replace(/"/g, '\\"')}"`,
    { stdio: "pipe" }
  );

  console.log(`  Seeded ${Math.min(i + CHUNK_SIZE, airports.length)}/${airports.length}`);
}

console.log("Done!");
