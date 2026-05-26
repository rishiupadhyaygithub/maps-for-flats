#!/usr/bin/env npx ts-node --esm
/**
 * Manual scraper runner — run from project root:
 *   npx ts-node --esm scripts/scrape.ts [source]
 *   npx ts-node --esm scripts/scrape.ts magicbricks
 *   npx ts-node --esm scripts/scrape.ts all
 *
 * Requires .env.local to be loaded (uses dotenv).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { runScraper } from "../scrapers";

const source = process.argv[2] ?? "all";
console.log(`\n🏙️  Maps for Flats — Scraper`);
console.log(`Source: ${source}`);
console.log(`Started: ${new Date().toISOString()}\n`);

runScraper(source)
  .then((results) => {
    console.log("\n✅ Done:");
    results.forEach((r) => {
      console.log(`  ${r.source}: ${r.count} listings, ${r.errors} errors`);
    });
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  });
