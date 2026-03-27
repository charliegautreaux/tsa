export function Footer() {
  return (
    <footer className="border-t border-gray-200/50 py-6 dark:border-gray-800/50">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col items-center gap-2 text-center text-xs text-gray-400 dark:text-gray-500">
          <p className="text-sm italic text-gray-500 dark:text-gray-400">
            Did you PreBoard?
          </p>
          <div className="mt-3 flex gap-4 text-xs">
            <a href="/blog" className="hover:text-gray-300">Blog</a>
            <a href="/privacy" className="hover:text-gray-300">Privacy</a>
            <a href="/disclosure" className="hover:text-gray-300">Disclosure</a>
          </div>
          <p>
            <span className="font-medium text-gray-500 dark:text-gray-400">
              PreBoard
            </span>{" "}
            is not affiliated with TSA or any government agency.
          </p>
          <p>
            Wait times are estimates and may not reflect actual conditions.
            Always allow extra time.
          </p>
        </div>
      </div>
    </footer>
  );
}
