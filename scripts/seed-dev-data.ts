/**
 * Seeds local D1 with sample checkpoints, current_waits, readings, and predictions
 * so the frontend displays data during local development.
 *
 * Usage: npx tsx scripts/seed-dev-data.ts
 */

import { execSync } from "child_process";

function d1(sql: string) {
  execSync(
    `npx wrangler d1 execute preboard-db --local --command "${sql.replace(/"/g, '\\"')}"`,
    { stdio: "pipe" }
  );
}

const now = new Date().toISOString().replace("T", " ").slice(0, 19);

// --- Checkpoints for top 10 airports ---
const checkpoints: { id: string; airport: string; name: string; terminal: string }[] = [
  { id: "atl-main", airport: "ATL", name: "Main Checkpoint", terminal: "Domestic" },
  { id: "atl-north", airport: "ATL", name: "North Checkpoint", terminal: "T-North" },
  { id: "atl-south", airport: "ATL", name: "South Checkpoint", terminal: "T-South" },
  { id: "dfw-a", airport: "DFW", name: "Terminal A", terminal: "A" },
  { id: "dfw-d", airport: "DFW", name: "Terminal D", terminal: "D" },
  { id: "dfw-e", airport: "DFW", name: "Terminal E", terminal: "E" },
  { id: "den-bridge", airport: "DEN", name: "Bridge Security", terminal: "Jeppesen" },
  { id: "den-a", airport: "DEN", name: "Gate A Security", terminal: "A" },
  { id: "ord-1", airport: "ORD", name: "Terminal 1", terminal: "1" },
  { id: "ord-2", airport: "ORD", name: "Terminal 2", terminal: "2" },
  { id: "ord-3", airport: "ORD", name: "Terminal 3", terminal: "3" },
  { id: "lax-tbit", airport: "LAX", name: "Tom Bradley International", terminal: "TBIT" },
  { id: "lax-1", airport: "LAX", name: "Terminal 1", terminal: "1" },
  { id: "jfk-1", airport: "JFK", name: "Terminal 1", terminal: "1" },
  { id: "jfk-4", airport: "JFK", name: "Terminal 4", terminal: "4" },
  { id: "jfk-8", airport: "JFK", name: "Terminal 8", terminal: "8" },
  { id: "sfo-1", airport: "SFO", name: "Terminal 1", terminal: "1" },
  { id: "sfo-i", airport: "SFO", name: "International Terminal", terminal: "International" },
  { id: "sea-main", airport: "SEA", name: "Main Terminal", terminal: "Main" },
  { id: "sea-n", airport: "SEA", name: "North Satellite", terminal: "N" },
  { id: "mco-main", airport: "MCO", name: "Terminal C", terminal: "C" },
  { id: "ewr-a", airport: "EWR", name: "Terminal A", terminal: "A" },
  { id: "ewr-b", airport: "EWR", name: "Terminal B", terminal: "B" },
  { id: "clt-main", airport: "CLT", name: "Main Checkpoint", terminal: "Main" },
  { id: "phx-main", airport: "PHX", name: "Terminal 4", terminal: "4" },
  { id: "iah-a", airport: "IAH", name: "Terminal A", terminal: "A" },
  { id: "mia-main", airport: "MIA", name: "Central Terminal", terminal: "Central" },
  { id: "las-main", airport: "LAS", name: "Terminal 1", terminal: "1" },
  { id: "msp-1", airport: "MSP", name: "Terminal 1", terminal: "1" },
  { id: "bos-a", airport: "BOS", name: "Terminal A", terminal: "A" },
];

console.log("Seeding checkpoints...");
const cpValues = checkpoints
  .map(
    (c) =>
      `('${c.id}', '${c.airport}', '${c.name}', '${c.terminal}', 1, 1, 0, 'open', '${now}', '${now}')`
  )
  .join(",\n    ");
d1(
  `INSERT OR IGNORE INTO checkpoints (id, airport_code, name, terminal, has_standard, has_precheck, has_clear, status, created_at, updated_at) VALUES\n    ${cpValues};`
);

// --- Current waits ---
console.log("Seeding current_waits...");
const lanes = ["standard", "precheck"] as const;
const tiers = ["near_live", "predicted"] as const;
const trends = ["rising", "falling", "stable"] as const;

const waitRows: string[] = [];
for (const cp of checkpoints) {
  for (const lane of lanes) {
    const base = lane === "standard" ? 15 + Math.floor(Math.random() * 40) : 3 + Math.floor(Math.random() * 15);
    const confidence = 0.6 + Math.random() * 0.35;
    const trend = trends[Math.floor(Math.random() * trends.length)];
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    waitRows.push(
      `('${cp.airport}', '${cp.id}', '${lane}', ${base}, ${confidence.toFixed(2)}, '${trend}', 'api', '${tier}', '${now}')`
    );
  }
}

// Chunk to avoid SQL too long
const CHUNK = 30;
for (let i = 0; i < waitRows.length; i += CHUNK) {
  const chunk = waitRows.slice(i, i + CHUNK).join(",\n    ");
  d1(
    `INSERT OR REPLACE INTO current_waits (airport_code, checkpoint_id, lane_type, wait_minutes, confidence, trend, source_type, data_tier, updated_at) VALUES\n    ${chunk};`
  );
}

// --- Readings (recent history) ---
console.log("Seeding readings (last 6 hours)...");
const readingChunks: string[] = [];
const hoursBack = 6;
const interval = 15; // minutes
for (const cp of checkpoints.slice(0, 15)) {
  // top 15 checkpoints only, to keep it reasonable
  for (let m = 0; m < hoursBack * 60; m += interval) {
    const t = new Date(Date.now() - m * 60 * 1000);
    const measuredAt = t.toISOString().replace("T", " ").slice(0, 19);
    const wait = 10 + Math.floor(Math.random() * 35);
    readingChunks.push(
      `('${cp.airport}', '${cp.id}', 'standard', ${wait}, 0.75, 'api', '${measuredAt}')`
    );
  }
}

for (let i = 0; i < readingChunks.length; i += CHUNK) {
  const chunk = readingChunks.slice(i, i + CHUNK).join(",\n    ");
  d1(
    `INSERT INTO readings (airport_code, checkpoint_id, lane_type, wait_minutes, confidence, source_type, measured_at) VALUES\n    ${chunk};`
  );
}

// --- Predictions (next 4 hours) ---
console.log("Seeding predictions (next 4 hours)...");
const predRows: string[] = [];
for (const cp of checkpoints.slice(0, 15)) {
  for (let m = 0; m < 4 * 60; m += 15) {
    const t = new Date(Date.now() + m * 60 * 1000);
    const forecastTime = t.toISOString().replace("T", " ").slice(0, 19);
    const wait = 8 + Math.floor(Math.random() * 30);
    predRows.push(
      `('${cp.airport}', '${cp.id}', 'standard', '${forecastTime}', ${wait}, 0.70, '${now}')`
    );
  }
}

for (let i = 0; i < predRows.length; i += CHUNK) {
  const chunk = predRows.slice(i, i + CHUNK).join(",\n    ");
  d1(
    `INSERT OR REPLACE INTO predictions (airport_code, checkpoint_id, lane_type, forecast_time, predicted_wait, confidence, generated_at) VALUES\n    ${chunk};`
  );
}

// --- Update airport data_tier to near_live for airports with data ---
console.log("Updating airport data tiers...");
const airportsWithData = [...new Set(checkpoints.map((c) => c.airport))];
d1(
  `UPDATE airports SET data_tier = 'near_live', updated_at = '${now}' WHERE iata IN (${airportsWithData.map((a) => `'${a}'`).join(",")});`
);

console.log("Dev data seeded successfully!");
console.log(`  ${checkpoints.length} checkpoints`);
console.log(`  ${waitRows.length} current wait entries`);
console.log(`  ${readingChunks.length} historical readings`);
console.log(`  ${predRows.length} predictions`);
