/**
 * scrape-grapes-and-grains — image harvester for grapesandgrains.com, the
 * City Hive storefront that serves the largest overlap with our POS catalog.
 *
 * This is a thin wrapper around ./lib/cityhive-scraper. All logic lives in
 * that library so we can spin up additional City Hive retailers by dropping
 * in a similar ~30-line wrapper with a different CityHiveConfig.
 *
 * USAGE:
 *   pnpm scrape:gng                   # full pipeline, dry run (no DB writes)
 *   pnpm scrape:gng -- --write        # full pipeline, commit matches to DB
 *   pnpm scrape:gng -- --phase=apply --write --min-token-score=0.9
 *                                     # re-run apply on existing matches,
 *                                     # with a stricter fuzzy-match floor
 *   pnpm scrape:gng -- --limit=10 --verbose
 *                                     # 10-product smoke test with logs
 *
 * See ./lib/cityhive-scraper.ts for the flag reference, phase contract, and
 * instructions for onboarding a new City Hive retailer.
 *
 * ENV:
 *   SUPABASE_DB_URL      Postgres connection string (needed for match/apply).
 *                        Loaded from .env.local if not already in the shell.
 */

import process from "node:process";
import { runCityHivePipeline, parseArgs, type CityHiveConfig } from "../lib/cityhive-scraper";

const CONFIG: CityHiveConfig = {
  retailerSlug: "grapes-and-grains",
  displayName: "Grapes & Grains",
  baseUrl: "https://grapesandgrains.com",
  // Must be in catalog_products_image_source_check constraint.
  // Added by supabase/migrations/20260423120000_catalog_image_source_gng.sql.
  imageSource: "grapes_and_grains",
  logTag: "gng",
};

runCityHivePipeline(CONFIG, parseArgs()).catch((e) => {
  console.error("[gng] fatal:", e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
