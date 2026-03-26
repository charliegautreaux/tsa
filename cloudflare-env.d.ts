declare global {
  interface CloudflareEnv {
    // D1 Database — all application data
    DB: D1Database;

    // KV — hot cache layer
    CACHE: KVNamespace;

    // R2 — map tiles and static assets
    TILES: R2Bucket;

    // Durable Objects — realtime WebSocket hubs
    AIRPORT_HUB: DurableObjectNamespace;

    // Static assets
    ASSETS: Fetcher;

    // Environment variables
    ENVIRONMENT: string;
    FLIGHTAWARE_API_KEY?: string;
  }
}

export {};
