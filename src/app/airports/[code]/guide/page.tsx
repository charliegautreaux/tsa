import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  getAirport,
  getCheckpoints,
  getHourlyAverages,
} from '@/lib/db/d1';
import { FAQJsonLd, WebPageJsonLd } from '@/components/seo/json-ld';
import { GuideSection } from '@/components/guide/guide-section';
import { PeakHoursChart } from '@/components/guide/peak-hours-chart';
import { AdSlot } from '@/components/ads/ad-slot';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  const { env } = await getCloudflareContext();
  const airport = await getAirport(env.DB, upper);
  if (!airport) return {};

  return {
    title: `TSA Wait Times at ${airport.name} (${upper}): Complete Guide — PreBoard`,
    description: `Everything you need to know about TSA security at ${airport.name}. Peak hours, checkpoint tips, PreCheck lanes, and live wait times.`,
  };
}

export default async function AirportGuidePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const { env } = await getCloudflareContext();

  const airport = await getAirport(env.DB, code);
  if (!airport) notFound();

  const [checkpoints, hourlyAvg] = await Promise.all([
    getCheckpoints(env.DB, code),
    getHourlyAverages(env.DB, code),
  ]);

  const faqQuestions = [
    {
      question: `How long is TSA security at ${airport.name}?`,
      answer: `TSA wait times at ${code} vary by time of day. Check PreBoard for live wait times updated every minute.`,
    },
    {
      question: `Does ${code} have TSA PreCheck?`,
      answer: checkpoints.some((cp) => cp.has_precheck)
        ? `Yes, ${code} has TSA PreCheck lanes available.`
        : `Check the ${code} airport page on PreBoard for the latest checkpoint information.`,
    },
    {
      question: `What is the best time to go through security at ${code}?`,
      answer: `Early morning (before 6 AM) and mid-afternoon (1-3 PM) typically have the shortest lines at ${code}.`,
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <WebPageJsonLd
        title={`TSA Wait Times at ${airport.name}`}
        description={`Complete guide to TSA security at ${airport.name}.`}
        url={`https://preboard.ai/airports/${code}/guide`}
      />
      <FAQJsonLd questions={faqQuestions} />

      <Link
        href={`/airports/${code}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {code} Live Data
      </Link>

      <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">
        TSA Wait Times at {airport.name} ({code})
      </h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Everything you need to know about security at {airport.name} in{' '}
        {airport.city}, {airport.state}.
      </p>

      <div className="my-6 flex justify-center">
        <AdSlot id={`guide-${code}-top`} size="leaderboard" />
      </div>

      <GuideSection title={`When Are TSA Lines Longest at ${code}?`}>
        <PeakHoursChart data={hourlyAvg} />
        <p className="mt-4">
          Based on historical data, the busiest times at {airport.name} are
          typically early morning (5-8 AM) and late afternoon (4-6 PM). For the
          shortest wait, aim for mid-morning or early afternoon.
        </p>
      </GuideSection>

      {checkpoints.length > 0 && (
        <GuideSection title="Checkpoints">
          <ul className="list-inside list-disc space-y-1">
            {checkpoints.map((cp) => (
              <li key={cp.id}>
                <strong>{cp.name}</strong>
                {cp.terminal ? ` (Terminal ${cp.terminal})` : ''}
                {cp.has_precheck ? ' — PreCheck available' : ''}
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      <div className="my-6 flex justify-center">
        <AdSlot id={`guide-${code}-mid`} size="rectangle" />
      </div>

      <GuideSection title="TSA PreCheck & CLEAR">
        <p>
          PreCheck members typically wait under 5 minutes at {code}. Many travel
          credit cards reimburse the $78 enrollment fee.{' '}
          <Link
            href="/blog/tsa-precheck-vs-clear"
            className="text-purple-600 underline dark:text-purple-400"
          >
            Compare PreCheck vs CLEAR &rarr;
          </Link>
        </p>
      </GuideSection>

      <GuideSection title="Tips for Faster Security">
        <ul className="list-inside list-disc space-y-1">
          <li>Check PreBoard before heading to the airport for live wait times</li>
          <li>Arrive at least 2 hours before domestic flights, 3 hours for international</li>
          <li>Have your ID and boarding pass ready before joining the line</li>
          <li>Wear easy-to-remove shoes and avoid excessive metal jewelry</li>
        </ul>
      </GuideSection>

      <GuideSection title="Frequently Asked Questions">
        <div className="space-y-4">
          {faqQuestions.map((q) => (
            <div key={q.question}>
              <h3 className="font-medium">{q.question}</h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {q.answer}
              </p>
            </div>
          ))}
        </div>
      </GuideSection>
    </main>
  );
}
