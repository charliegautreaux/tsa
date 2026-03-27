import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { GAProvider } from "@/components/analytics/ga-provider";
import { WebVitals } from "@/components/analytics/web-vitals";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import { CookieBanner } from "@/components/consent/cookie-banner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://preboard.cgautreauxnc.workers.dev'),
  title: "PreBoard — Live TSA Wait Times",
  description:
    "Real-time TSA security line wait times for every US airport. Did you PreBoard?",
  openGraph: {
    title: "PreBoard — Live TSA Wait Times",
    description:
      "Real-time TSA security line wait times for every US airport. Did you PreBoard?",
    type: "website",
    siteName: "PreBoard",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  other: {
    "theme-color": "#7C3AED",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased dark:bg-[#0c0c14] dark:text-gray-100">
        <GAProvider />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <WebVitals />
          <div className="mesh-bg">
            <TopNav />
            <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
            <CookieBanner />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
