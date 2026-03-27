import type { MetadataRoute } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAllAirports } from '@/lib/db/d1';
import { getAllPosts } from '@/lib/content/blog';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://preboard.ai';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { env } = await getCloudflareContext();
  const airports = await getAllAirports(env.DB);
  const posts = getAllPosts();

  const airportEntries: MetadataRoute.Sitemap = airports.flatMap((a) => [
    {
      url: `${BASE_URL}/airports/${a.iata}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/airports/${a.iata}/guide`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ]);

  const blogEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date('2026-03-26'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/disclosure`,
      lastModified: new Date('2026-03-26'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    ...airportEntries,
    ...blogEntries,
  ];
}
