#!/usr/bin/env node
/**
 * Generate PNG icon files from the master app-icon.svg.
 * Requires sharp: npm install sharp --save-dev
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error(
      "sharp is not installed. Run: npm install sharp --save-dev\n" +
        "Then re-run: node scripts/generate-icons.mjs"
    );
    process.exit(1);
  }

  const svgPath = resolve(root, "public/app-icon.svg");
  if (!existsSync(svgPath)) {
    console.error(`SVG source not found at ${svgPath}`);
    process.exit(1);
  }

  const svg = readFileSync(svgPath);

  for (const { name, size } of sizes) {
    const out = resolve(root, "public", name);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // Generate favicon.ico (32x32 PNG wrapped — browsers accept PNG-in-ICO)
  const ico32 = await sharp(svg).resize(32, 32).png().toBuffer();
  const { writeFileSync } = await import("fs");
  writeFileSync(resolve(root, "public/favicon.ico"), ico32);
  console.log("  ✓ favicon.ico (32x32)");

  console.log("\nDone! Icons saved to public/");
  console.log(
    "Update manifest.json icon entries if you want PNG references alongside SVG."
  );
}

main().catch(console.error);
