/**
 * fetch-openfoodfacts-images — populate catalog_products.image_url from the
 * public OpenFoodFacts (+ OpenBeautyFacts + OpenProductsFacts) UPC database.
 *
 * Why: after running google-images, we still have catalog rows with no
 * photo — especially cheap well-known items with real UPC barcodes that
 * Google Custom Search doesn't return clean images for. OpenFoodFacts is a
 * free, crowdsourced product database keyed by UPC. It's the exact dataset
 * the Yuka / OFF mobile app uses. Coverage for beer and non-alcoholic
 * mixers is surprisingly good; wine and spirits are spottier but it's free
 * and fast, so we run it before falling back to paid options.
 *
 * For each catalog row missing image_url AND with a non-null UPC:
 *   1. GET https://world.openfoodfacts.org/api/v0/product/{UPC}.json
 *   2. If status=1 and product has image_front_url (or image_url), accept it
 *   3. Update catalog_products.image_url, set image_source='upc_api',
 *      image_quality_score=2 (higher than Google's 1 — UPC match is more
 *      precise than a free-text search).
 *
 * DESIGN CHOICES:
 *   - We prefer `image_front_url` (cleanest shot of the front label) over
 *     the generic `image_url` which OFF sometimes points at ingredient
 *     panels or nutrition tables.
 *   - We store the original OFF-hosted URL. Their CDN is stable and has
 *     been up for 10+ years. If it rots we re-run with --replace-stale.
 *   - Single-threaded, 700ms throttle. OFF's polite-use guidance is
 *     "~100 req/min from one IP". 700ms = ~85/min, leaves headroom.
 *   - NO API key. OFF is fully open; they only ask you set a descriptive
 *     User-Agent so they can see who's polling them.
 *   - We try WORLD first; their regional subdomains (us.openfoodfacts.org)
 *     are mirrors so no point calling both.
 *
 * USAGE:
 *   # Test on 10 products first
 *   pnpm off-images:test
 *
 *   # Commit on a small slice
 *   pnpm off-images -- --limit=50 --write --verbose
 *
 *   # Only beer (where OFF coverage is best)
 *   pnpm off-images -- --category=beer --write
 *
 *   # Full run
 *   pnpm off-images -- --write
 *
 * ENV:
 *   SUPABASE_DB_URL   Postgres connection string (service-role)
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
    // 700ms = ~85 req/min. OFF polite-use guidance is ~100/min from one IP.
    throttleMs: 700,
    output: `scripts/eval-results/fetch-openfoodfacts-images-${new Date().toISOString().slice(0, 10)}.json`,
    replaceStale: false,
  };
  for (const a of raw) {
    if (a === "--") continue;
    if (a === "--write") args.write = true;
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a.startsWith("--offset=")) args.offset = Number(a.split("=")[1]) || 0;
    else if (a.startsWith("--category=")) args.category = a.split("=")[1];
    else if (a.startsWith("--throttle=")) args.throttleMs = Number(a.split("=")[1]) || 700;
    else if (a.startsWith("--output=")) args.output = a.split("=")[1];
    else if (a === "--replace-stale") args.replaceStale = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "fetch-openfoodfacts-images — fill catalog_products.image_url from OpenFoodFacts UPC lookup\n" +
          "  --write              Commit (otherwise dry run)\n" +
          "  --limit=<n>          Process at most N products\n" +
          "  --offset=<n>         Skip first N (for resume)\n" +
          "  --category=<cat>     Restrict to wine/beer/spirits/mixer/garnish\n" +
          "  --throttle=<ms>      Delay between OFF API calls (default 700ms)\n" +
          "  --replace-stale      Also re-query rows where image_source='upc_api'\n" +
          "  --verbose            Log each product's UPC + result\n",
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
  upc: string;
  canonical_name: string;
  brand: string | null;
  category: string;
  size_ml: number | null;
};

type OffProduct = {
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  image_small_url?: string;
  product_name?: string;
  brands?: string;
};

type OffResponse = {
  status?: 0 | 1;
  status_verbose?: string;
  product?: OffProduct;
  code?: string;
};

// ---------------------------------------------------------------------------
// OpenFoodFacts client
// ---------------------------------------------------------------------------

/**
 * OFF asks for a descriptive User-Agent so they can contact the operator if
 * something goes wrong. This string identifies us + version + contact path.
 */
const USER_AGENT = "BevTek-CatalogEnricher/1.0 (https://bevtek.ai; contact: mike@bevtek.ai)";

async function offLookup(
  upc: string,
): Promise<
  | { ok: true; imageUrl: string; name: string | null; brand: string | null }
  | { ok: false; reason: string }
> {
  // Normalize: strip any whitespace, keep only digits. OFF accepts UPC-A
  // (12 digits), UPC-E, EAN-8, and EAN-13 — their lookup endpoint takes
  // whatever digit string you give it and does the matching server-side.
  const code = upc.replace(/\D/g, "");
  if (!code) return { ok: false, reason: "empty-upc" };

  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
  } catch (e) {
    return { ok: false, reason: `network: ${(e as Error).message}` };
  }
  if (!res.ok) {
    return { ok: false, reason: `http ${res.status}` };
  }
  let json: OffResponse;
  try {
    json = (await res.json()) as OffResponse;
  } catch (e) {
    return { ok: false, reason: `json-parse: ${(e as Error).message}` };
  }

  if (json.status !== 1 || !json.product) {
    // 0 = "product not found". Normal outcome for non-food barcodes.
    return { ok: false, reason: "not-found" };
  }
  const p = json.product;
  // Prefer `image_front_url` (the clean front-label shot). Fall back to
  // `image_url` which OFF sometimes uses for generic/multi-angle shots.
  // Both are full-size; the `_small_url` variants are thumbnails we don't
  // want for a product grid.
  const img =
    (typeof p.image_front_url === "string" && p.image_front_url) ||
    (typeof p.image_url === "string" && p.image_url) ||
    null;
  if (!img) return { ok: false, reason: "no-image" };

  return {
    ok: true,
    imageUrl: img,
    name: typeof p.product_name === "string" ? p.product_name : null,
    brand: typeof p.brands === "string" ? p.brands : null,
  };
}

// ---------------------------------------------------------------------------
// DB I/O
// ---------------------------------------------------------------------------

async function fetchCatalogRows(
  client: Client,
  args: Args,
): Promise<CatalogRow[]> {
  const where: string[] = ["upc is not null", "upc <> ''"];
  const params: (string | number)[] = [];
  if (args.replaceStale) {
    where.push(`(image_url is null or image_source = 'upc_api')`);
  } else {
    where.push("image_url is null");
  }
  if (args.category) {
    params.push(args.category);
    where.push(`category = $${params.length}`);
  }
  let sql = `
    select id::text, upc, canonical_name, brand, category, size_ml
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
  // image_quality_score = 2: higher than google_search (1) because a UPC
  // match is precise by construction — no string-matching ambiguity.
  await client.query(
    `update public.catalog_products
        set image_url           = $2,
            image_source        = 'upc_api',
            image_quality_score = greatest(coalesce(image_quality_score, 0), 2),
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

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("Missing env: SUPABASE_DB_URL");
    process.exit(1);
  }

  mkdirSync(path.dirname(args.output), { recursive: true });
  const started_at = new Date().toISOString();
  writeFileSync(args.output, JSON.stringify({ started_at, args }) + "\n");

  console.log("[off-images] starting", {
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
    queried: 0,
    matched: 0,
    not_found: 0,
    no_image: 0,
    errors: 0,
    written: 0,
    dry_run: !args.write,
  };

  try {
    const rows = await fetchCatalogRows(client, args);
    summary.considered = rows.length;
    console.log(`[off-images] ${rows.length} catalog row(s) with UPC need images.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const result = await offLookup(row.upc);
        summary.queried++;
        if (!result.ok) {
          if (result.reason === "not-found") summary.not_found++;
          else if (result.reason === "no-image") summary.no_image++;
          else summary.errors++;
          if (args.verbose) {
            const tag = result.reason === "not-found" ? "[miss]" : "[skip]";
            console.log(
              `  ${tag} ${row.canonical_name.slice(0, 50).padEnd(50)} upc=${row.upc.padEnd(14)} ${result.reason}`,
            );
          }
          appendFileSync(
            args.output,
            JSON.stringify({
              id: row.id,
              upc: row.upc,
              name: row.canonical_name,
              status: "miss",
              reason: result.reason,
            }) + "\n",
          );
        } else {
          summary.matched++;
          appendFileSync(
            args.output,
            JSON.stringify({
              id: row.id,
              upc: row.upc,
              name: row.canonical_name,
              status: "match",
              url: result.imageUrl,
              off_name: result.name,
              off_brand: result.brand,
            }) + "\n",
          );
          if (args.verbose) {
            console.log(
              `  [hit ] ${row.canonical_name.slice(0, 50).padEnd(50)} upc=${row.upc.padEnd(14)} → ${result.imageUrl.slice(0, 80)}`,
            );
          }
          if (args.write) {
            try {
              await setCatalogImage(client, row.id, result.imageUrl);
              summary.written++;
            } catch (e) {
              summary.errors++;
              console.warn(
                `  [db  ] update failed for ${row.id}: ${(e as Error).message}`,
              );
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
          `[off-images] progress: ${i + 1}/${rows.length} queried=${summary.queried} matched=${summary.matched} written=${summary.written} not_found=${summary.not_found} errors=${summary.errors}`,
        );
      }

      // Throttle: OFF asks for <~100 req/min from one IP.
      if (args.throttleMs > 0 && i < rows.length - 1) {
        await sleep(args.throttleMs);
      }
    }
  } finally {
    summary.finished_at = new Date().toISOString();
    appendFileSync(args.output, JSON.stringify({ summary }) + "\n");
    await client.end();
  }

  const hitRate =
    summary.queried > 0
      ? ((summary.matched / summary.queried) * 100).toFixed(1)
      : "0.0";
  console.log("\n[off-images] done", { ...summary, hit_rate_pct: hitRate });
}

main().catch((e) => {
  console.error("[off-images] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
