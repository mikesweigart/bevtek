/**
 * fetch-wikipedia-images — populate catalog_products.image_url from the
 * lead image of the closest Wikipedia article.
 *
 * Why: well-known brands (Buffalo Trace, Budweiser, Dom Pérignon, Jack
 * Daniel's) almost always have a Wikipedia page with a clean product /
 * bottle / distillery photo that's explicitly Commons-licensed. That makes
 * it the safest image source legally (free-to-use) and the cleanest
 * visually (editorial standards on Commons).
 *
 * For each catalog row missing image_url:
 *   1. OpenSearch the brand + canonical_name → pick top page title
 *   2. Fetch that page's pageimages via the Action API
 *   3. Take `original.source` (full-size Commons URL) or fall back to
 *      `thumbnail.source`
 *   4. Update catalog_products.image_url, set image_source='wikipedia',
 *      image_quality_score=3 (highest of our automated sources — editorial
 *      quality is consistently higher than Google/OFF crowd submissions).
 *
 * DESIGN CHOICES:
 *   - OpenSearch first (title match), then pageimages (image lookup). Two
 *     API calls per product but both are free + fast. OpenSearch is how
 *     Wikipedia's own search bar works, so fuzzy brand names ("Jack
 *     Daniels" → "Jack Daniel's") resolve correctly.
 *   - We DO NOT blindly trust the top OpenSearch result — we check the
 *     returned title contains the brand token (or the canonical name)
 *     before accepting. Otherwise "Jose" could match the movie rather than
 *     Cuervo.
 *   - We store the Commons-hosted URL directly. Commons is a stable
 *     nonprofit host (upload.wikimedia.org); URLs are effectively permanent
 *     as long as the file isn't deleted from Commons.
 *   - Rate-limit: 500ms between products = 4 API calls/sec against
 *     wikipedia.org. Wikipedia's API has no hard rate limit but their
 *     etiquette guide asks for "serial" not "parallel" and a User-Agent.
 *
 * USAGE:
 *   # Test on 10 products first
 *   pnpm wiki-images:test
 *
 *   # Commit on a small slice
 *   pnpm wiki-images -- --limit=50 --write --verbose
 *
 *   # Only spirits (where Wikipedia coverage is best — major distilleries)
 *   pnpm wiki-images -- --category=spirits --write
 *
 *   # Full run
 *   pnpm wiki-images -- --write
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
    throttleMs: 500, // polite-use: Wikipedia API has no hard limit but asks for serial
    output: `scripts/eval-results/fetch-wikipedia-images-${new Date().toISOString().slice(0, 10)}.json`,
    replaceStale: false,
  };
  for (const a of raw) {
    if (a === "--") continue;
    if (a === "--write") args.write = true;
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a.startsWith("--offset=")) args.offset = Number(a.split("=")[1]) || 0;
    else if (a.startsWith("--category=")) args.category = a.split("=")[1];
    else if (a.startsWith("--throttle=")) args.throttleMs = Number(a.split("=")[1]) || 500;
    else if (a.startsWith("--output=")) args.output = a.split("=")[1];
    else if (a === "--replace-stale") args.replaceStale = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "fetch-wikipedia-images — fill catalog_products.image_url from Wikipedia pageimages\n" +
          "  --write              Commit (otherwise dry run)\n" +
          "  --limit=<n>          Process at most N products\n" +
          "  --offset=<n>         Skip first N (for resume)\n" +
          "  --category=<cat>     Restrict to wine/beer/spirits/mixer/garnish\n" +
          "  --throttle=<ms>      Delay between Wikipedia calls (default 500ms)\n" +
          "  --replace-stale      Also re-query rows where image_source='wikipedia'\n" +
          "  --verbose            Log each product's match + result\n",
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

// Wikipedia opensearch response: [query, [titles], [descriptions], [urls]]
type OpenSearchResponse = [string, string[], string[], string[]];

type PageImageInfo = {
  title: string;
  thumbnail?: { source: string; width: number; height: number };
  original?: { source: string; width: number; height: number };
  pageimage?: string;
};

type PageImagesResponse = {
  query?: {
    pages?: Record<string, PageImageInfo>;
  };
};

// ---------------------------------------------------------------------------
// Wikipedia client
// ---------------------------------------------------------------------------

const USER_AGENT = "BevTek-CatalogEnricher/1.0 (https://bevtek.ai; contact: mike@bevtek.ai)";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

async function wikiJson<T>(params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, format: "json", origin: "*" });
  const url = `${WIKI_API}?${qs.toString()}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * OpenSearch a brand+name query and return the best-matching page title,
 * or null if nothing plausible comes back.
 *
 * We require the returned title to contain either (a) the brand, or
 * (b) at least the first two words of the canonical_name. This prevents
 * "Jose" from matching "Jose (film)" when we really wanted "Jose Cuervo".
 */
async function findPageTitle(row: CatalogRow): Promise<string | null> {
  const query = buildQuery(row);
  const resp = await wikiJson<OpenSearchResponse>({
    action: "opensearch",
    search: query,
    limit: "5",
    namespace: "0", // main articles only, not templates/categories
  });
  if (!Array.isArray(resp) || !Array.isArray(resp[1]) || resp[1].length === 0) {
    return null;
  }
  const titles = resp[1];
  const brandLower = (row.brand ?? "").toLowerCase();
  const firstTwoWords = row.canonical_name
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .toLowerCase();
  for (const t of titles) {
    const lower = t.toLowerCase();
    // Skip obvious disambiguation / film / song pages
    if (/\((film|song|album|video game|band|disambiguation)\)/i.test(t)) continue;
    if (brandLower && lower.includes(brandLower)) return t;
    if (firstTwoWords && lower.includes(firstTwoWords)) return t;
  }
  return null;
}

function buildQuery(row: CatalogRow): string {
  const parts: string[] = [];
  if (row.brand && !row.canonical_name.toLowerCase().includes(row.brand.toLowerCase())) {
    parts.push(row.brand);
  }
  parts.push(row.canonical_name);
  return parts.join(" ").trim();
}

/**
 * Fetch the lead image for a Wikipedia page title. Returns the full-size
 * original if available, otherwise the thumbnail — both are on Commons.
 */
async function getPageImage(title: string): Promise<string | null> {
  const resp = await wikiJson<PageImagesResponse>({
    action: "query",
    titles: title,
    prop: "pageimages",
    piprop: "original|thumbnail",
    pithumbsize: "800",
  });
  const pages = resp?.query?.pages;
  if (!pages) return null;
  // The API keys pages by page id but "-1" means not-found.
  for (const [pageId, info] of Object.entries(pages)) {
    if (pageId === "-1") return null;
    if (info.original?.source) return info.original.source;
    if (info.thumbnail?.source) return info.thumbnail.source;
  }
  return null;
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
    where.push(`(image_url is null or image_source = 'wikipedia')`);
  } else {
    where.push("image_url is null");
  }
  // Require a brand OR a sufficiently specific name — Wikipedia opensearch
  // on just "Red Wine" returns the Wikipedia page about red wine, which is
  // useless. We need at least one discriminating token.
  where.push(`(brand is not null or length(canonical_name) >= 10)`);
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
  // image_quality_score = 3 — highest of our automated sources because
  // Commons images pass editorial review before upload.
  await client.query(
    `update public.catalog_products
        set image_url           = $2,
            image_source        = 'wikipedia',
            image_quality_score = greatest(coalesce(image_quality_score, 0), 3),
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

  console.log("[wiki-images] starting", {
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
    page_found: 0,
    image_found: 0,
    no_page: 0,
    no_image: 0,
    errors: 0,
    written: 0,
    dry_run: !args.write,
  };

  try {
    const rows = await fetchCatalogRows(client, args);
    summary.considered = rows.length;
    console.log(`[wiki-images] ${rows.length} catalog row(s) need images.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        summary.searched++;
        const title = await findPageTitle(row);
        if (!title) {
          summary.no_page++;
          if (args.verbose) {
            console.log(
              `  [miss] ${row.canonical_name.slice(0, 50).padEnd(50)} no wikipedia page`,
            );
          }
          appendFileSync(
            args.output,
            JSON.stringify({
              id: row.id,
              name: row.canonical_name,
              status: "miss",
              reason: "no-page",
            }) + "\n",
          );
        } else {
          summary.page_found++;
          // Tiny inter-call delay to not hammer the same IP with two
          // back-to-back requests.
          await sleep(150);
          const imageUrl = await getPageImage(title);
          if (!imageUrl) {
            summary.no_image++;
            if (args.verbose) {
              console.log(
                `  [skip] ${row.canonical_name.slice(0, 50).padEnd(50)} page="${title}" but no image`,
              );
            }
            appendFileSync(
              args.output,
              JSON.stringify({
                id: row.id,
                name: row.canonical_name,
                status: "miss",
                reason: "no-image",
                page_title: title,
              }) + "\n",
            );
          } else {
            summary.image_found++;
            appendFileSync(
              args.output,
              JSON.stringify({
                id: row.id,
                name: row.canonical_name,
                status: "match",
                page_title: title,
                url: imageUrl,
              }) + "\n",
            );
            if (args.verbose) {
              console.log(
                `  [hit ] ${row.canonical_name.slice(0, 50).padEnd(50)} page="${title.slice(0, 30)}" → ${imageUrl.slice(0, 70)}`,
              );
            }
            if (args.write) {
              try {
                await setCatalogImage(client, row.id, imageUrl);
                summary.written++;
              } catch (e) {
                summary.errors++;
                console.warn(
                  `  [db  ] update failed for ${row.id}: ${(e as Error).message}`,
                );
              }
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
          `[wiki-images] progress: ${i + 1}/${rows.length} searched=${summary.searched} image_found=${summary.image_found} written=${summary.written} no_page=${summary.no_page} no_image=${summary.no_image} errors=${summary.errors}`,
        );
      }

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
    summary.searched > 0
      ? ((summary.image_found / summary.searched) * 100).toFixed(1)
      : "0.0";
  console.log("\n[wiki-images] done", { ...summary, hit_rate_pct: hitRate });
}

main().catch((e) => {
  console.error("[wiki-images] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
