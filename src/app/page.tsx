import { AirportCard } from "@/components/airport/airport-card";
import type { AirportOverview } from "@/lib/types/airport";

export const runtime = "edge";
export const revalidate = 30;

async function getOverview(): Promise<AirportOverview[]> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/v1/map/overview`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { airports?: AirportOverview[] };
  return data.airports ?? [];
}

export default async function Home() {
  const airports = await getOverview();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">TSA Wait Times</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {airports.length} airports sorted by longest current wait
        </p>
      </div>

      {airports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg">No airport data available yet.</p>
          <p className="text-sm">Feed data will appear once ingestion starts.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {airports.map((airport) => (
            <AirportCard key={airport.iata} airport={airport} />
          ))}
        </div>
      )}
    </main>
  );
}
