import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report Wait Time — PreBoard.ai",
  description: "Submit your TSA security wait time to help other travelers.",
};

export default function ReportPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold tracking-tight">Report Wait Time</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-400">
        Report form coming soon.
      </p>
      <a
        href="/"
        className="mt-6 text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to Map
      </a>
    </main>
  );
}
