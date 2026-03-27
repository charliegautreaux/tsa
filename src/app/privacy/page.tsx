import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PreBoard',
  description: 'How PreBoard handles your data and privacy.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="gradient-text text-3xl font-bold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 26, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Information We Collect
          </h2>
          <p className="mt-2">
            PreBoard collects anonymous usage data through Google Analytics 4,
            including pages visited, device type, and approximate location
            (country/region). We do not collect personally identifiable
            information unless you voluntarily submit a wait time report.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cookies & Tracking
          </h2>
          <p className="mt-2">
            We use cookies for analytics and advertising. Our ad partners may
            use cookies to serve relevant ads. You can manage your cookie
            preferences using the consent banner that appears when you first
            visit the site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Advertising
          </h2>
          <p className="mt-2">
            PreBoard displays advertisements through third-party ad networks.
            These partners may use cookies and similar technologies to serve ads
            based on your interests. We do not sell your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Your Rights
          </h2>
          <p className="mt-2">
            Under CCPA and GDPR, you have the right to access, delete, and opt
            out of the sale of your personal information. To exercise these
            rights, contact us at privacy@preboard.ai.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Data Retention
          </h2>
          <p className="mt-2">
            Analytics data is retained according to Google Analytics default
            settings (14 months). Wait time reports submitted through the site
            are stored indefinitely to improve data quality.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Contact
          </h2>
          <p className="mt-2">
            For privacy questions, contact privacy@preboard.ai.
          </p>
        </section>
      </div>
    </main>
  );
}
