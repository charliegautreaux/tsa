import type { FeedAdapter } from "./base";
import type { AdapterType } from "@/lib/types/feed";

const adapters = new Map<string, FeedAdapter>();

export function registerAdapter(adapter: FeedAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getAdapter(type: AdapterType | string): FeedAdapter | null {
  return adapters.get(type) ?? null;
}

export function getAllAdapters(): FeedAdapter[] {
  return Array.from(adapters.values());
}
