import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { AirportSearch } from "@/components/search/airport-search";

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/50 bg-white/90 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02] dark:backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm dark:shadow-[0_0_12px_rgba(59,130,246,0.3)]">
            P
          </div>
          <span className="text-lg font-bold tracking-tight">
            PreBoard
            <span className="text-blue-600 dark:text-blue-400">.ai</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <AirportSearch />
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
