/**
 * Post-build script: injects a `scheduled` handler into the OpenNext worker.
 *
 * OpenNext generates `.open-next/worker.js` with only a `fetch` handler.
 * Cloudflare cron triggers fire `scheduled` events, so we need to add one.
 *
 * The scheduled handler creates a synthetic request to `/api/v1/cron`
 * and passes it directly to the existing fetch handler (no external HTTP call).
 */
import { readFileSync, writeFileSync } from "node:fs";

const WORKER_PATH = ".open-next/worker.js";

const source = readFileSync(WORKER_PATH, "utf-8");

// The generated worker looks like:
//   export default {
//       async fetch(request, env, ctx) { ... },
//   };
//
// We transform it to:
//   const _worker = {
//       async fetch(request, env, ctx) { ... },
//       async scheduled(controller, env, ctx) { ... },
//   };
//   export default _worker;

if (source.includes("async scheduled")) {
  console.log("[inject-cron] scheduled handler already present, skipping.");
  process.exit(0);
}

if (!source.includes("export default {")) {
  console.error("[inject-cron] Could not find 'export default {' in worker.js");
  process.exit(1);
}

const CRON_MAP = `
    // Map cron patterns to trigger types
    const cronTrigger = {
      "* * * * *": "poll",        // every minute: poll active feeds
      "*/5 * * * *": "predict",   // every 5 min: run predictions
      "0 * * * *": "all",         // every hour: full cycle
      "0 */6 * * *": "all",       // every 6 hours: full cycle
    };`;

const SCHEDULED_HANDLER = `    async scheduled(controller, env, ctx) {${CRON_MAP}
      const trigger = cronTrigger[controller.cron] || "poll";
      const request = new Request(
        \`https://localhost/api/v1/cron?trigger=\${trigger}\`,
        { headers: { "Authorization": \`Bearer \${env.CRON_SECRET || ""}\` } }
      );
      ctx.waitUntil(_worker.fetch(request, env, ctx));
    },`;

let patched = source.replace("export default {", "const _worker = {");

// Find the last `};` and insert the scheduled handler before it, then re-export
const lastClose = patched.lastIndexOf("};");
if (lastClose === -1) {
  console.error("[inject-cron] Could not find closing '};' in worker.js");
  process.exit(1);
}

patched =
  patched.slice(0, lastClose) +
  SCHEDULED_HANDLER +
  "\n};\nexport default _worker;\n";

writeFileSync(WORKER_PATH, patched, "utf-8");
console.log("[inject-cron] Injected scheduled handler into worker.js");
