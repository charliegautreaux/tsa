import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CheckpointRow } from "@/components/airport/checkpoint-row";
import { DataTierBadge } from "@/components/shared/data-tier-badge";
import type { Metadata } from "next";

export const runtime = "edge";
export const revalidate = 15;

interface LiveData {
  airport: {
    code: string;
    name: string;
    city: string;
    state: string;
    data_tier: string;
  };
  checkpoints: {
    id: string;
    name: string;
    terminal: string | null;
    status: string;
    lanes: Record<string, unknown>;
    updated_at: string | null;
  }[];
  meta: {
    data_tier: string;
    sources_active: number;
    generated_at: string;
  };
}

async function getLiveData(code: string): Promise<LiveData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/v1/airports/${code}/live`, {
    next: { revalidate: 15 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `${code.toUpperCase()} — PreBoard.ai`,
    description: `TSA wait times at ${code.toUpperCase()}`,
  };
}

export default async function AirportDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getLiveData(code.toUpperCase());

  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        All airports
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{data.airport.code}</h1>
          <DataTierBadge tier={data.airport.data_tier as any} />
        </div>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          {data.airport.name} — {data.airport.city}, {data.airport.state}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {data.meta.sources_active} data source{data.meta.sources_active !== 1 ? "s" : ""} active
        </p>
      </div>

      {data.checkpoints.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p>No checkpoint data available for this airport.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.checkpoints.map((cp) => (
            <CheckpointRow key={cp.id} checkpoint={cp as any} />
          ))}
        </div>
      )}
    </main>
  );
}
