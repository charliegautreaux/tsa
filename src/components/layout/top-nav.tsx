import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { AirportSearch } from "@/components/search/airport-search";
import { SignalIcon } from "@/components/shared/signal-icon";

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/50 bg-white/90 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02] dark:backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <SignalIcon size={28} />
          <span className="text-lg font-bold tracking-tight">
            PreBoard
            <span className="ml-0.5 text-sm font-normal text-gray-400 dark:text-gray-500">
              .ai
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <AirportSearch />
          <Link
            href="/blog"
            className="hidden text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:block"
          >
            Blog
          </Link>
          <Link
            href="/report"
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:shadow-[0_0_12px_rgba(59,130,246,0.2)]"
          >
            Report
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
