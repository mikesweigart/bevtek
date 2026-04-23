/**
 * scrape-liquor-barn — image harvester for liquorbarn.com (City Hive
 * storefront, Louisville KY-based). ~450-500 products in the sitemap.
 *
 * This is a thin wrapper around ./lib/cityhive-scraper. All logic lives in
 * that library — see its header JSDoc for the phase contract and flag ref.
 *
 * USAGE:
 *   pnpm scrape:lb                   # full pipeline, dry run (no DB writes)
 *   pnpm scrape:lb -- --write        # full pipeline, commit matches to DB
 *   pnpm scrape:lb -- --limit=10 --verbose
 *                                    # 10-product smoke test with logs
 *
 * ENV:
 *   SUPABASE_DB_URL      Postgres connection string (needed for match/apply).
 *                        Loaded from .env.local if not already in the shell.
 */

import process from "node:process";
import { runCityHivePipeline, parseArgs, type CityHiveConfig } from "./lib/cityhive-scraper";

const CONFIG: CityHiveConfig = {
  retailerSlug: "liquor-barn",
  displayName: "Liquor Barn",
  baseUrl: "https://liquorbarn.com",
  // Must be in catalog_products_image_source_check constraint.
  // Added by supabase/migrations/20260423130000_catalog_image_source_liquor_barn.sql.
  imageSource: "liquor_barn",
  logTag: "lb",
};

runCityHivePipeline(CONFIG, parseArgs()).catch((e) => {
  console.error("[lb] fatal:", e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
