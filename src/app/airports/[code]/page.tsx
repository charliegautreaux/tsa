import { notFound } from "next/navigation";
import Link from "next/link";
import { WebPageJsonLd } from '@/components/seo/json-ld';
import { ArrowLeft } from "lucide-react";
import { CheckpointRow } from "@/components/airport/checkpoint-row";
import { DataTierBadge } from "@/components/shared/data-tier-badge";
import { Sparkline } from "@/components/shared/sparkline";
import { AdSlot } from "@/components/ads/ad-slot";
import { PreCheckCTA } from "@/components/affiliate/precheck-cta";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getAirport,
  getCheckpoints,
  getCurrentWaits,
  getRecentReadings,
} from "@/lib/db/d1";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  const { env } = await getCloudflareContext();
  const airport = await getAirport(env.DB, upper);
  const name = airport?.name ?? upper;

  return {
    title: `TSA Wait Times at ${name} (${upper}) — PreBoard`,
    description: `Live TSA security line wait times at ${name}. Check current checkpoint status, predictions, and tips for ${upper}.`,
    openGraph: {
      title: `${upper} TSA Wait Times — PreBoard`,
      description: `Real-time security wait times at ${name}.`,
    },
  };
}

export default async function AirportDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const { env } = await getCloudflareContext();

  const airport = await getAirport(env.DB, code);
  if (!airport) notFound();

  const [checkpoints, currentWaits, recentReadings] = await Promise.all([
    getCheckpoints(env.DB, code),
    getCurrentWaits(env.DB, code),
    getRecentReadings(env.DB, code, 6),
  ]);

  // Build checkpoint data from known checkpoints
  const knownCpIds = new Set(checkpoints.map((cp) => cp.id));
  const checkpointData = checkpoints.map((cp) => {
    const waits = currentWaits.filter((w) => w.checkpoint_id === cp.id);
    const lanes: Record<string, unknown> = {};
    for (const w of waits) {
      lanes[w.lane_type] = {
        wait_minutes: w.wait_minutes,
        trend: w.trend,
        confidence: w.confidence,
        source: w.source_type,
      };
    }
    return {
      id: cp.id,
      name: cp.name,
      terminal: cp.terminal,
      status: cp.status,
      lanes,
      updated_at: waits[0]?.updated_at ?? null,
    };
  });

  // Dynamic checkpoints
  const dynamicCpIds = [
    ...new Set(
      currentWaits
        .filter((w) => !knownCpIds.has(w.checkpoint_id))
        .map((w) => w.checkpoint_id)
    ),
  ];
  for (const cpId of dynamicCpIds) {
    const waits = currentWaits.filter((w) => w.checkpoint_id === cpId);
    const lanes: Record<string, unknown> = {};
    for (const w of waits) {
      lanes[w.lane_type] = {
        wait_minutes: w.wait_minutes,
        trend: w.trend,
        confidence: w.confidence,
        source: w.source_type,
      };
    }
    const namePart = cpId.replace(/^[a-z]{3}-/, "");
    checkpointData.push({
      id: cpId,
      name: namePart
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
      terminal: null,
      status: "open",
      lanes,
      updated_at: waits[0]?.updated_at ?? null,
    });
  }

  // Build trend data per checkpoint
  const trendMap = new Map<string, number[]>();
  const byCheckpoint = new Map<string, typeof recentReadings>();
  for (const r of recentReadings) {
    const arr = byCheckpoint.get(r.checkpoint_id) ?? [];
    arr.push(r);
    byCheckpoint.set(r.checkpoint_id, arr);
  }
  for (const [cpId, readings] of byCheckpoint) {
    readings.sort((a, b) => a.measured_at.localeCompare(b.measured_at));
    const step = Math.max(1, Math.floor(readings.length / 12));
    const sampled = readings.filter(
      (_, i) => i % step === 0 || i === readings.length - 1
    );
    trendMap.set(
      cpId,
      sampled.map((r) => r.wait_minutes)
    );
  }

  // Airport-wide sparkline (standard lane)
  const stdReadings = recentReadings.filter(
    (r) => r.lane_type === "standard"
  );
  stdReadings.sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const airportTrend =
    stdReadings.length >= 2
      ? (() => {
          const step = Math.max(1, Math.floor(stdReadings.length / 12));
          return stdReadings
            .filter((_, i) => i % step === 0 || i === stdReadings.length - 1)
            .map((r) => r.wait_minutes);
        })()
      : [];

  const sourcesActive = new Set(currentWaits.map((w) => w.source_type)).size;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <WebPageJsonLd
        title={`TSA Wait Times at ${airport.name} (${code})`}
        description={`Live TSA security wait times at ${airport.name}.`}
        url={`https://preboard.cgautreauxnc.workers.dev/airports/${code}`}
      />
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        All airports
      </Link>

      {/* Airport Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="gradient-text text-4xl font-bold tracking-tight sm:text-5xl">
            {airport.iata}
          </h1>
          <DataTierBadge tier={airport.data_tier} />
        </div>
        <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
          {airport.name}
        </p>
        <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
          {airport.city}, {airport.state} &middot; {sourcesActive} data source
          {sourcesActive !== 1 ? "s" : ""} active
        </p>
        <Link
          href={`/airports/${code}/guide`}
          className="mt-2 inline-block text-sm text-purple-600 hover:underline dark:text-purple-400"
        >
          Read our complete {code} security guide →
        </Link>

        {/* Airport-wide trend chart */}
        {airportTrend.length >= 2 && (
          <div className="glass mt-6 rounded-2xl p-5">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>Standard lane trend &middot; last 6 hours</span>
              <span>Now</span>
            </div>
            <Sparkline
              data={airportTrend}
              id={`${code}-overview`}
              className="h-24 w-full"
            />
          </div>
        )}
      </div>

      <div className="my-6 flex justify-center">
        <AdSlot id={`${code}-detail-1`} size="leaderboard" />
      </div>

      {/* Checkpoints */}
      {checkpointData.length === 0 ? (
        <div className="glass rounded-2xl py-12 text-center text-gray-400">
          <p>No checkpoint data available for this airport.</p>
        </div>
      ) : (
        <div className="stagger space-y-4">
          {checkpointData.map((cp) => (
            <CheckpointRow
              key={cp.id}
              checkpoint={cp as any}
              trendData={trendMap.get(cp.id)}
            />
          ))}
        </div>
      )}

      {/* Affiliate CTA */}
      <div className="mt-8">
        <PreCheckCTA
          waitMinutes={
            currentWaits.length > 0
              ? Math.max(...currentWaits.filter(w => w.lane_type === 'standard').map(w => w.wait_minutes))
              : undefined
          }
        />
      </div>
    </main>
  );
}
