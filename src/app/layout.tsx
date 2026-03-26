import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "PreBoard.ai — Live TSA Wait Times",
  description:
    "Real-time TSA security line wait times for every US airport. Check PreBoard before you board.",
  openGraph: {
    title: "PreBoard.ai — Live TSA Wait Times",
    description:
      "Real-time TSA security line wait times for every US airport.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
