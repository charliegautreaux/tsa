import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            PreBoard<span className="text-blue-600 dark:text-blue-400">.ai</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/report"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Report Wait
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
