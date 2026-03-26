import type { Metadata } from "next";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `${code.toUpperCase()} — PreBoard.ai`,
    description: `Live TSA wait times at ${code.toUpperCase()} airport.`,
  };
}

export default async function AirportPage({ params }: Props) {
  const { code } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold tracking-tight">
        {code.toUpperCase()}
      </h1>
      <p className="mt-4 text-gray-600 dark:text-gray-400">
        Airport detail view coming soon.
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
