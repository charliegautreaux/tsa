import type { MetadataRoute } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAllAirports } from '@/lib/db/d1';

const BASE_URL = 'https://preboard.cgautreauxnc.workers.dev';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { env } = await getCloudflareContext();
  const airports = await getAllAirports(env.DB);

  const airportEntries: MetadataRoute.Sitemap = airports.map((a) => ({
    url: `${BASE_URL}/airports/${a.iata}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 1,
    },
    ...airportEntries,
  ];
}
