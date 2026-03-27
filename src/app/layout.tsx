import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
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
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased dark:bg-[#0c0c14] dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="mesh-bg">
            <TopNav />
            <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
