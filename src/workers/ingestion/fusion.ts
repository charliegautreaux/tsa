import type { RawReading } from "@/lib/adapters/base";

const SOURCE_PRIORITY: Record<string, number> = {
  sensor: 4,
  "airport-api": 3,
  crowdsourced: 2,
  predicted: 1,
};

export function fuseReadings(readings: RawReading[]): RawReading[] {
  if (readings.length === 0) return [];

  // Group by checkpoint_id + lane_type
  const groups = new Map<string, RawReading[]>();
  for (const r of readings) {
    const key = `${r.checkpoint_id}|${r.lane_type}`;
    const group = groups.get(key) || [];
    group.push(r);
    groups.set(key, group);
  }

  const fused: RawReading[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      fused.push(group[0]);
      continue;
    }

    // Sort by source priority (highest first)
    group.sort((a, b) => (SOURCE_PRIORITY[b.source_type] || 0) - (SOURCE_PRIORITY[a.source_type] || 0));
    const best = { ...group[0] };

    // Boost confidence when sensor + crowd agree within 5 min
    const sensorReading = group.find((r) => r.source_type === "sensor");
    const crowdReading = group.find((r) => r.source_type === "crowdsourced");
    if (sensorReading && crowdReading) {
      const diff = Math.abs(sensorReading.wait_minutes - crowdReading.wait_minutes);
      if (diff <= 5) {
        best.confidence = Math.min(0.98, best.confidence + 0.03);
      }
    }

    fused.push(best);
  }
  return fused;
}
