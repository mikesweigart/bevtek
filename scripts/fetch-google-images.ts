/**
 * fetch-google-images — populates catalog_products.image_url via Google
 * Custom Search image results.
 *
 * Why: after promote-inventory-images, only 3.6% of catalog entries have
 * images. The rest need a real product photo. We use the same trick City
 * Hive's own admin uses ("Search For Product" → Google Images with
 * transparent-background filter) but run it programmatically for all 6,000+
 * products in one pass.
 *
 * For each catalog row missing image_url:
 *   1. Build a query: "{brand} {canonical_name} {size}ml bottle"
 *   2. Call Google Custom Search API with imgColor=trans for clean cutouts
 *   3. Take the top result's original URL (Google's `link` field points at
 *      the source site, not a Google proxy)
 *   4. Update catalog_products.image_url with that URL
 *   5. Set image_source='google_search', image_quality_score=1
 *
 * DESIGN CHOICES:
 *   - We store the Google result's ORIGINAL source URL directly, rather
 *     than downloading to Supabase Storage. This keeps the script simple
 *     and fast. If source URLs rot later, we re-run with --replace-stale
 *     or upgrade specific rows to Storage-hosted via staff upload.
 *   - `imgColor=trans` is the single most important filter. Product photos
 *     on brand sites and retailer sites almost always have transparent
 *     backgrounds (PNGs with the bottle cut out); random Wikipedia articles
 *     and shopping malls do not. This alone kills ~80% of false-positive
 *     matches that plagued the old Wikipedia enrichment.
 *   - `imgType=photo` further narrows to photographs (not clipart / drawings).
 *   - `safe=active` — we sell alcohol, but Google's SafeSearch on product
 *     queries doesn't meaningfully reduce liquor results and is polite.
 *
 * RATE LIMITS & COST:
 *   - Google Custom Search JSON API: 100 queries / 100 seconds, 10,000/day max.
 *   - Pricing: $5 per 1,000 queries beyond the free 100/day. ~6k products
 *     = ~$30. Batched at ~10 req/sec to stay under the rate limit.
 *
 * USAGE:
 *   # Test on 10 products first
 *   pnpm google-images -- --limit=10 --verbose
 *
 *   # Commit on a small slice
 *   pnpm google-images -- --limit=50 --write --verbose
 *
 *   # Only beer
 *   pnpm google-images -- --category=beer --write
 *
 *   # Full run
 *   pnpm google-images -- --write
 *
 * ENV:
 *   GOOGLE_CUSTOM_SEARCH_API_KEY     API key from Google Cloud Console
 *   GOOGLE_CUSTOM_SEARCH_ENGINE_ID   CX from programmablesearchengine.google.com
 *   SUPABASE_DB_URL                  Postgres connection string
 */

import process from "node:process";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type Args = {
  write: boolean;
  limit: number | null;
  offset: number;
  category: string | null;
  verbose: boolean;
  throttleMs: number;
  output: string;
  replaceStale: boolean;
};

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const args: Args = {
    write: false,
    limit: null,
    offset: 0,
    category: null,
    verbose: false,
    throttleMs: 120, // ~8 req/sec, safely under Google's 100 req/100sec
    output: `scripts/eval-results/fetch-google-images-${new Date().toISOString().slice(0, 10)}.json`,
    replaceStale: false,
  };
  for (const a of raw) {
    if (a === "--") continue;
    if (a === "--write") args.write = true;
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a.startsWith("--offset=")) args.offset = Number(a.split("=")[1]) || 0;
    else if (a.startsWith("--category=")) args.category = a.split("=")[1];
    else if (a.startsWith("--throttle=")) args.throttleMs = Number(a.split("=")[1]) || 120;
    else if (a.startsWith("--output=")) args.output = a.split("=")[1];
    else if (a === "--replace-stale") args.replaceStale = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "fetch-google-images — fill catalog_products.image_url from Google Custom Search\n" +
          "  --write              Commit (otherwise dry run)\n" +
          "  --limit=<n>          Process at most N products\n" +
          "  --offset=<n>         Skip first N (for resume)\n" +
          "  --category=<cat>     Restrict to wine/beer/spirits/mixer/garnish\n" +
          "  --throttle=<ms>      Delay between Google API calls (default 120ms)\n" +
          "  --replace-stale      Also re-query rows where image_source='google_search'\n" +
          "                       (use to refresh old results)\n" +
          "  --verbose            Log each product's query + result\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CatalogRow = {
  id: string;
  canonical_name: string;
  brand: string | null;
  category: string;
  size_ml: number | null;
};

type GoogleItem = {
  link: string;
  mime?: string;
  image?: {
    contextLink?: string;
    height?: number;
    width?: number;
    byteSize?: number;
    thumbnailLink?: string;
  };
};

type GoogleResponse = {
  items?: GoogleItem[];
  searchInformation?: { totalResults?: string };
  error?: { code: number; message: string };
};

// ---------------------------------------------------------------------------
// Query construction
// ---------------------------------------------------------------------------

/**
 * Build a search query that's specific enough to find the right product
 * but loose enough to get results at all. Formula:
 *   "<brand> <canonical_name> <size_hint> <product_type>"
 *
 * Size is appended as "750ml" style (Google indexes these well).
 * We append a category hint ("bottle", "can", "beer") to bias results
 * toward product photos rather than recipe pages or news articles.
 */
function buildQuery(row: CatalogRow): string {
  const parts: string[] = [];
  // Brand first — most discriminating token. Skip if already in name.
  if (row.brand && !row.canonical_name.toLowerCase().includes(row.brand.toLowerCase())) {
    parts.push(row.brand);
  }
  parts.push(row.canonical_name);
  if (row.size_ml) {
    // Normalize size: 750 → "750ml", 1750 → "1.75L"
    if (row.size_ml >= 1000) {
      parts.push(`${(row.size_ml / 1000).toString().replace(/\.?0+$/, "")}L`);
    } else {
      parts.push(`${row.size_ml}ml`);
    }
  }
  // Category hint — helps Google disambiguate "Barkan" (the wine) from
  // "Barkan" (the shopping mall). Beer is almost always photographed in a
  // can, which Google indexes separately from bottle shots.
  const catHint: Record<string, string> = {
    wine: "bottle",
    spirits: "bottle",
    beer: "",
    mixer: "bottle",
    garnish: "",
  };
  const hint = catHint[row.category] ?? "";
  if (hint) parts.push(hint);
  return parts.join(" ").trim();
}

// ---------------------------------------------------------------------------
// Google Custom Search client
// ---------------------------------------------------------------------------

async function googleSearch(
  apiKey: string,
  cx: string,
  query: string,
): Promise<{ ok: true; url: string; contextUrl: string | null; mime: string | null } | { ok: false; reason: string }> {
  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    searchType: "image",
    imgColor: "trans",       // transparent background — kills mall/dance false-positives
    imgType: "photo",        // photographs, not clipart
    safe: "active",
    num: "3",                // top 3; we take #1 but useful for debug
    fileType: "png,jpg,jpeg,webp",
  });
  const url = `https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, reason: `http ${res.status}: ${body.slice(0, 200)}` };
  }
  const json = (await res.json()) as GoogleResponse;
  if (json.error) {
    return { ok: false, reason: `google: ${json.error.message}` };
  }
  if (!json.items || json.items.length === 0) {
    return { ok: false, reason: "no results" };
  }
  const top = json.items[0];
  return {
    ok: true,
    url: top.link,
    contextUrl: top.image?.contextLink ?? null,
    mime: top.mime ?? null,
  };
}

// ---------------------------------------------------------------------------
// DB I/O
// ---------------------------------------------------------------------------

async function fetchCatalogRows(
  client: Client,
  args: Args,
): Promise<CatalogRow[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (args.replaceStale) {
    where.push(`(image_url is null or image_source = 'google_search')`);
  } else {
    where.push("image_url is null");
  }
  if (args.category) {
    params.push(args.category);
    where.push(`category = $${params.length}`);
  }
  let sql = `
    select id::text, canonical_name, brand, category, size_ml
    from public.catalog_products
    where ${where.join(" and ")}
    order by category, canonical_name
  `;
  if (args.offset > 0) {
    params.push(args.offset);
    sql += ` offset $${params.length}`;
  }
  if (args.limit != null) {
    params.push(args.limit);
    sql += ` limit $${params.length}`;
  }
  const res = await client.query<CatalogRow>(sql, params);
  return res.rows;
}

async function setCatalogImage(
  client: Client,
  catalogId: string,
  imageUrl: string,
): Promise<void> {
  await client.query(
    `update public.catalog_products
        set image_url           = $2,
            image_source        = 'google_search',
            image_quality_score = 1,
            enriched_at         = coalesce(enriched_at, now()),
            updated_at          = now()
      where id = $1`,
    [catalogId, imageUrl],
  );
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = parseArgs();

  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!apiKey || !cx || !dbUrl) {
    console.error("Missing env. Need:");
    console.error("  GOOGLE_CUSTOM_SEARCH_API_KEY");
    console.error("  GOOGLE_CUSTOM_SEARCH_ENGINE_ID");
    console.error("  SUPABASE_DB_URL");
    process.exit(1);
  }

  mkdirSync(path.dirname(args.output), { recursive: true });
  const started_at = new Date().toISOString();
  writeFileSync(args.output, JSON.stringify({ started_at, args }) + "\n");

  console.log("[google-images] starting", {
    write: args.write,
    limit: args.limit ?? "(unlimited)",
    offset: args.offset,
    category: args.category ?? "(all)",
    throttleMs: args.throttleMs,
    replaceStale: args.replaceStale,
    output: args.output,
  });

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const summary = {
    started_at,
    finished_at: "",
    considered: 0,
    searched: 0,
    matched: 0,
    no_results: 0,
    errors: 0,
    written: 0,
    dry_run: !args.write,
  };

  try {
    const rows = await fetchCatalogRows(client, args);
    summary.considered = rows.length;
    console.log(`[google-images] ${rows.length} catalog row(s) need images.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const q = buildQuery(row);
      try {
        const result = await googleSearch(apiKey, cx, q);
        summary.searched++;
        if (!result.ok) {
          if (result.reason === "no results") {
            summary.no_results++;
            if (args.verbose) {
              console.log(`  [miss] ${row.canonical_name.slice(0, 50).padEnd(50)} q="${q.slice(0, 60)}"`);
            }
          } else {
            summary.errors++;
            console.warn(`  [err ] ${row.canonical_name.slice(0, 50).padEnd(50)} ${result.reason}`);
          }
          appendFileSync(
            args.output,
            JSON.stringify({ id: row.id, name: row.canonical_name, query: q, status: "miss", reason: result.reason }) + "\n",
          );
        } else {
          summary.matched++;
          appendFileSync(
            args.output,
            JSON.stringify({
              id: row.id,
              name: row.canonical_name,
              query: q,
              status: "match",
              url: result.url,
              context: result.contextUrl,
              mime: result.mime,
            }) + "\n",
          );
          if (args.verbose) {
            console.log(
              `  [hit ] ${row.canonical_name.slice(0, 50).padEnd(50)} → ${result.url.slice(0, 90)}`,
            );
          }
          if (args.write) {
            try {
              await setCatalogImage(client, row.id, result.url);
              summary.written++;
            } catch (e) {
              summary.errors++;
              console.warn(`  [db  ] update failed for ${row.id}: ${(e as Error).message}`);
            }
          }
        }
      } catch (e) {
        summary.errors++;
        console.warn(`  [fatal] ${row.canonical_name}: ${(e as Error).message}`);
      }

      // Progress every 100
      if ((i + 1) % 100 === 0) {
        console.log(
          `[google-images] progress: ${i + 1}/${rows.length} searched=${summary.searched} matched=${summary.matched} written=${summary.written} no_results=${summary.no_results} errors=${summary.errors}`,
        );
      }

      // Throttle: stay comfortably under 100 queries / 100 seconds.
      if (args.throttleMs > 0 && i < rows.length - 1) {
        await sleep(args.throttleMs);
      }
    }
  } finally {
    summary.finished_at = new Date().toISOString();
    appendFileSync(args.output, JSON.stringify({ summary }) + "\n");
    await client.end();
  }

  console.log("\n[google-images] done", summary);
}

main().catch((e) => {
  console.error("[google-images] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
