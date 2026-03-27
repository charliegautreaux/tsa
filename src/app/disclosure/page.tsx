import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure — PreBoard',
  description: 'How PreBoard earns revenue through affiliate partnerships.',
};

export default function DisclosurePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="gradient-text text-3xl font-bold tracking-tight">
        Affiliate Disclosure
      </h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 26, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        <p>
          PreBoard is a free service. To keep it free, we participate in
          affiliate programs that allow us to earn commissions when you click
          links on our site and make a purchase or complete an application.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            What This Means for You
          </h2>
          <p className="mt-2">
            When we recommend products like travel credit cards, TSA PreCheck
            enrollment, CLEAR memberships, or airport parking, some of these
            links may be affiliate links. If you click and complete an
            application or purchase, we may receive a commission at no additional
            cost to you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Our Commitment
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>We only recommend products we believe provide genuine value</li>
            <li>Affiliate relationships never influence our wait time data</li>
            <li>We clearly label affiliate content throughout the site</li>
            <li>Our primary mission is accurate, real-time TSA wait time data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Partners
          </h2>
          <p className="mt-2">
            We may earn commissions through partnerships with credit card
            issuers, travel service providers, airport parking companies, and
            other travel-related businesses.
          </p>
        </section>
      </div>
    </main>
  );
}
