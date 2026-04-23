/**
 * cityhive-scraper — shared pipeline for scraping any City Hive storefront
 * (cityhive.net-powered retail sites) to harvest product images + metadata
 * and match them to catalog_products by fingerprint.
 *
 * WHY A SHARED LIBRARY. Dozens of US liquor retailers run on the City Hive
 * commerce platform (cityhive-production-cdn.cityhive.net serves all their
 * images). Their HTML structure, sitemap layout, image URL pattern, and
 * product-URL pattern are identical across storefronts. So one generic
 * pipeline can scrape every one of them — each retailer adds ~hundreds of
 * matched catalog images without a new scraper codebase.
 *
 * ADDING A NEW CITY HIVE RETAILER:
 *   1. Write a `supabase/migrations/YYYYMMDD_catalog_image_source_<slug>.sql`
 *      that adds '<slug>' to the catalog_products.image_source CHECK
 *      constraint (follow 20260423120000_catalog_image_source_gng.sql as a
 *      template). User applies via Supabase SQL editor.
 *   2. Create `scripts/scrape-<retailer>.ts` as a thin wrapper:
 *
 *        import process from "node:process";
 *        import { runCityHivePipeline, parseArgs, type CityHiveConfig }
 *          from "./lib/cityhive-scraper";
 *
 *        const CONFIG: CityHiveConfig = {
 *          retailerSlug: "<slug>",
 *          displayName: "<Retailer Name>",
 *          baseUrl: "https://<retailer>.com",
 *          imageSource: "<slug>",       // must match step-1 migration
 *          logTag: "<short>",           // optional short prefix for logs
 *        };
 *        runCityHivePipeline(CONFIG, parseArgs()).catch((e) => {
 *          console.error("[<short>] fatal:", e instanceof Error ? e.stack || e.message : e);
 *          process.exit(1);
 *        });
 *
 *   3. Add `scrape:<slug>` entries to root package.json scripts.
 *   4. Run `pnpm scrape:<slug> -- --limit=10 --verbose` to smoke-test the
 *      sitemap parser on that retailer, then remove --limit for the full run.
 *
 * CONTRACT. A CityHiveConfig must include:
 *   - retailerSlug:    kebab-case filesystem-safe id ("grapes-and-grains").
 *                      Used for NDJSON output paths and log prefix.
 *   - displayName:     human-readable name for logs ("Grapes & Grains").
 *   - baseUrl:         https root ("https://grapesandgrains.com"). No
 *                      trailing slash. Sitemap assumed at baseUrl + /sitemap.html.
 *   - imageSource:     value written to catalog_products.image_source
 *                      (e.g. "grapes_and_grains"). Must be allowed by the
 *                      catalog_products_image_source_check constraint.
 *
 * PIPELINE (4 phases, each resumable, each writes NDJSON for audit):
 *   1. index  — GET <baseUrl>/sitemap.html → extract every
 *               /shop/product/{slug}/{24-hex-id} URL.
 *   2. scrape — for each indexed URL, fetch the HTML and pull out the product
 *               name, size, image URL, description, price.
 *   3. match  — match each scraped product to one catalog_products row via
 *               4 tiers: fingerprint, core_name+size, core_name_only,
 *               token-set Jaccard with brand pre-filter.
 *   4. apply  — UPDATE catalog_products SET image_url = ... WHERE id = ...
 *               AND image_url IS NULL. COALESCE-guarded; will never overwrite
 *               an already-populated image.
 *
 * IDEMPOTENT. Each phase checks its own intermediate file and resumes from
 * where it stopped. The `apply` phase only writes to the DB when --write is
 * set. You can re-run dry-mode as many times as you like.
 */

import process from "node:process";
import { mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CityHiveConfig = {
  /** kebab-case id, used in NDJSON paths and log prefix */
  retailerSlug: string;
  /** human-readable name, e.g. "Grapes & Grains" */
  displayName: string;
  /** https root with no trailing slash, e.g. "https://grapesandgrains.com" */
  baseUrl: string;
  /**
   * Value written to catalog_products.image_source on apply.
   * MUST be allowed by the catalog_products_image_source_check constraint —
   * add a migration before running --write for a new retailer.
   */
  imageSource: string;
  /** Optional override for the log-line prefix. Defaults to retailerSlug. */
  logTag?: string;
};

export type Phase = "index" | "scrape" | "match" | "apply" | "all";

export type Args = {
  write: boolean;
  phase: Phase;
  limit: number | null;
  throttleMs: number;
  force: boolean;
  verbose: boolean;
  /**
   * Minimum match_score required for token_overlap matches to be applied.
   * Exact-tier matches (fingerprint, core_name_size, core_name_only) are
   * always applied — this only gates the fuzzy tier.
   * Review showed 0.75+ is ~0% false positive, 0.5-0.75 is ~20% FP.
   */
  minTokenScore: number;
};

// ---------------------------------------------------------------------------
// .env.local loader
// ---------------------------------------------------------------------------
// Minimal, zero-dep dotenv. Reads .env.local (preferred) or .env from the
// project root and populates process.env for any key that isn't already set.
// Exists so PowerShell users don't have to re-`$env:FOO=...` in every new
// shell — create the file once, every script picks it up.

export function loadDotenv(): void {
  const envPath = existsSync(".env.local") ? ".env.local" : existsSync(".env") ? ".env" : null;
  if (!envPath) return;
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trim = line.trim();
    if (!trim || trim.startsWith("#")) continue;
    const eq = trim.indexOf("=");
    if (eq < 0) continue;
    const key = trim.slice(0, eq).trim();
    let val = trim.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ---------------------------------------------------------------------------
// CLI parser (retailer-agnostic)
// ---------------------------------------------------------------------------

export function parseArgs(argv = process.argv.slice(2)): Args {
  const args: Args = {
    write: false,
    phase: "all",
    limit: null,
    // 1500ms default: at 300ms we hit Cloudflare's rate-limit hard (50%+
    // 429s). 1.5s lets the per-minute bucket drain between requests while
    // still finishing the typical 5-7k-product scrape in under 3 hours.
    throttleMs: 1500,
    force: false,
    verbose: false,
    minTokenScore: 0.75,
  };
  for (const a of argv) {
    if (a === "--") continue;
    if (a === "--write") args.write = true;
    else if (a.startsWith("--phase=")) {
      const p = a.split("=")[1] as Phase;
      if (!["index", "scrape", "match", "apply", "all"].includes(p)) {
        console.error(`Unknown phase: ${p}`);
        process.exit(2);
      }
      args.phase = p;
    } else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a.startsWith("--throttle=")) args.throttleMs = Number(a.split("=")[1]) || 1500;
    else if (a.startsWith("--min-token-score=")) {
      const v = Number(a.split("=")[1]);
      if (Number.isFinite(v) && v >= 0 && v <= 1) args.minTokenScore = v;
    } else if (a === "--force") args.force = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "scrape-<retailer> — harvest product images from a City Hive storefront\n" +
          "  --write              Commit apply phase to DB (dry run otherwise)\n" +
          "  --phase=<name>       index|scrape|match|apply|all (default all)\n" +
          "  --limit=<n>          Cap phase input (testing)\n" +
          "  --throttle=<ms>      Delay between page fetches (default 1500ms)\n" +
          "  --min-token-score=<n> Floor for fuzzy (token_overlap) matches at apply time.\n" +
          "                       Default 0.75 — below that, false-positive rate is ~20%.\n" +
          "  --force              Re-do a phase even if its output file exists\n" +
          "  --verbose            Print every URL / match decision\n",
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
// Constants
// ---------------------------------------------------------------------------

// Realistic UA so Cloudflare doesn't flag us as a bot. We're polite
// (throttled, low volume) — this just avoids tripping their heuristics.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readNdjson<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  const text = readFileSync(filePath, "utf-8");
  const out: T[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as T);
    } catch {
      // skip malformed lines (unlikely but defensive)
    }
  }
  return out;
}

// Back-compat: matches.ndjson written by the pre-productization
// scrape-grapes-and-grains.ts used gng_* field names. The productized
// library writes cityhive_* (retailer-agnostic). On read we normalize
// either shape into Match so we don't have to re-run match phase after
// the refactor.
function readMatchesNdjson(filePath: string): Match[] {
  type RawMatch = Partial<Match> & {
    gng_product_id?: string;
    gng_name?: string;
    gng_image_url?: string;
  };
  const rows = readNdjson<RawMatch>(filePath);
  return rows.map((m) => ({
    cityhive_product_id: m.cityhive_product_id ?? m.gng_product_id ?? "",
    cityhive_name: m.cityhive_name ?? m.gng_name ?? "",
    cityhive_image_url: m.cityhive_image_url ?? m.gng_image_url ?? "",
    catalog_product_id: m.catalog_product_id ?? "",
    catalog_canonical_name: m.catalog_canonical_name ?? "",
    match_type: m.match_type ?? "fingerprint",
    match_score: m.match_score ?? 0,
  }));
}

function appendNdjson(filePath: string, obj: unknown): void {
  appendFileSync(filePath, JSON.stringify(obj) + "\n");
}

// requireDbUrl — resolve and validate SUPABASE_DB_URL with helpful errors.
//
// Historical footgun: an env var containing a literal placeholder like
// "db.YOUR_PROJECT.supabase.co" would get past the "is it set?" check and
// fail later with a cryptic "getaddrinfo ENOTFOUND" at DNS resolution time.
// This guard catches common template strings so the operator sees a fix
// path, not a DNS error.
function requireDbUrl(): string {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("  SUPABASE_DB_URL not set.");
    console.error("  Add it to .env.local at repo root, or set in shell:");
    console.error('    $env:SUPABASE_DB_URL = "postgres://..."   # PowerShell');
    console.error("  Connection string: Supabase Dashboard → Project Settings → Database → Connection string → URI");
    process.exit(1);
  }
  // Common placeholder patterns from copy-pasted templates.
  if (/YOUR_PROJECT|your-project|\[YOUR[-_]PASSWORD\]|<your-password>/i.test(dbUrl)) {
    console.error("  SUPABASE_DB_URL contains a placeholder (e.g. YOUR_PROJECT or [YOUR-PASSWORD]).");
    console.error("  You're holding the template string, not the real connection URL.");
    console.error("  Grab the real one: Supabase Dashboard → Project Settings → Database → Connection string → URI");
    console.error("  In PowerShell the placeholder may be shadowing .env.local — run:");
    console.error("    Remove-Item env:SUPABASE_DB_URL");
    console.error("  before re-running, or set a fresh value with $env:SUPABASE_DB_URL = \"...\"");
    process.exit(1);
  }
  return dbUrl;
}

// ---------------------------------------------------------------------------
// Normalization helpers (MUST match scripts/build-catalog-products.ts exactly,
// otherwise fingerprints won't collide and matching will fail)
// ---------------------------------------------------------------------------

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\*dnr\*/gi, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSizeMlFromName(name: string): number | null {
  const s = name.toLowerCase();
  const literMatch = s.match(/\b(\d+(?:\.\d+)?)\s*l\b/);
  if (literMatch) {
    const liters = parseFloat(literMatch[1]);
    if (liters > 0 && liters <= 20) return Math.round(liters * 1000);
  }
  const mlMatch = s.match(/\b(\d+)\s*ml\b/);
  if (mlMatch) {
    const ml = parseInt(mlMatch[1], 10);
    if (ml > 0 && ml <= 20000) return ml;
  }
  const ozMatch = s.match(/\b(\d+(?:\.\d+)?)\s*oz\b/);
  if (ozMatch) {
    const oz = parseFloat(ozMatch[1]);
    if (oz > 0 && oz <= 100) {
      const ml = oz * 29.5735;
      if (Math.abs(ml - 355) < 10) return 355;
      if (Math.abs(ml - 473) < 15) return 473;
      if (Math.abs(ml - 651) < 15) return 651;
      if (Math.abs(ml - 750) < 20) return 750;
      if (Math.abs(ml - 237) < 10) return 237;
      if (Math.abs(ml - 946) < 20) return 946;
      return Math.round(ml);
    }
  }
  return null;
}

function parsePackCount(name: string): number {
  const m = name.toLowerCase().match(/\b(\d+)\s*(?:pk|pack)\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 100) return n;
  }
  return 1;
}

function extractCoreName(name: string): string {
  return name
    .replace(/\*dnr\*/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*ml\b/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*l\b/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*oz\b/gi, "")
    .replace(/\b\d+\s*(?:pk|pack)\b/gi, "")
    .replace(/\b(?:cn|can|btl|bottle|cans|bottles)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function computeFingerprint(
  brand: string | null,
  coreName: string,
  sizeMl: number | null,
  packCount: number,
): string {
  const b = normalize(brand);
  const n = normalize(coreName);
  const s = sizeMl != null ? String(sizeMl) : "nosize";
  const p = String(packCount);
  return `${b}|${n}|${s}|${p}`;
}

// ---------------------------------------------------------------------------
// HTTP with polite retries
// ---------------------------------------------------------------------------

// Cloudflare in front of City Hive storefronts rate-limits aggressively. We
// treat 429 separately from other errors: back off for the Retry-After
// window if the server sends one, else 30s * 1.5^attempt. Regular network
// errors keep the short 500ms→1s→2s backoff from before.
async function fetchHtml(url: string, tries = 5): Promise<string> {
  let lastErr: Error | null = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        // Retry-After can be seconds (most common) or an HTTP date. If it's
        // a plain number under 120, trust it; otherwise use our own ramp.
        let waitMs: number;
        if (retryAfter) {
          const n = Number(retryAfter);
          waitMs = Number.isFinite(n) && n > 0 && n < 120 ? n * 1000 : 30_000 * Math.pow(1.5, i);
        } else {
          waitMs = 30_000 * Math.pow(1.5, i); // 30s → 45s → 67s → 101s → 152s
        }
        console.warn(
          `  [429 ] rate-limited; sleeping ${Math.round(waitMs / 1000)}s (retry ${i + 1}/${tries})`,
        );
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e as Error;
      await sleep(500 * Math.pow(2, i)); // 500ms → 1s → 2s → 4s → 8s
    }
  }
  throw lastErr ?? new Error(`fetch failed for ${url}`);
}

// ---------------------------------------------------------------------------
// Intermediate types
// ---------------------------------------------------------------------------

type IndexedProduct = {
  product_id: string; // 24-char hex Mongo ObjectId from the URL
  slug: string;
  url: string;
};

type ScrapedProduct = IndexedProduct & {
  name: string; // full product name from <title> or og:title (entities decoded)
  image_url: string; // https://cityhive-production-cdn.cityhive.net/products/<imageId>/large.png
  image_id: string; // imageId parsed out (different from product_id!)
  size_ml: number | null; // parsed from name
  pack_count: number;
  core_name: string; // name with size/pack stripped (entities decoded)
  brand_guess: string | null; // best-effort first-words brand extraction
  // Metadata captured for the upcoming tasting-notes / description layer.
  // Not used by the image matcher — stored so a later pass can enrich
  // catalog_products with descriptions and prices without re-scraping.
  description: string | null; // og:description or meta[name=description]
  price_usd: number | null; // parsed from JSON-LD or data-price attr
  scraped_at: string;
};

type Match = {
  cityhive_product_id: string;
  cityhive_name: string;
  cityhive_image_url: string;
  catalog_product_id: string;
  catalog_canonical_name: string;
  match_type: "fingerprint" | "core_name_size" | "core_name_only" | "token_overlap"; // strongest first
  match_score: number; // 1.0 fingerprint, 0.9 core+size, 0.75 core only, 0.50–0.99 token
};

// ---------------------------------------------------------------------------
// Token-set similarity (tier-4 fuzzy match)
//
// Catalog canonical_name is POS-shorthand ("CAMARENA ANEJO"); City Hive
// storefront titles are marketing-style ("Familia Camarena Tequila Anejo").
// Exact-string matches never fire. Jaccard over normalized tokens handles
// the "extra words" problem: {familia, camarena, tequila, anejo} vs
// {camarena, anejo} → |∩|=2, |∪|=4, score=0.5.
//
// We filter stopwords under 2 chars (keeps "cn"/"oz"/"ml" style tokens out),
// and require a catalog brand token to appear in the scraped tokens — that's
// what keeps the candidate pool tiny and prevents matching "Red Wine" to
// every red wine in the catalog.
// ---------------------------------------------------------------------------

// CATEGORY_TOKENS — high-level product-type words that marketing titles
// stuff in ("... Tequila", "... Vermouth") but POS canonical_name generally
// omits. Stripped from the SCRAPED side only — asymmetric.
//
// Rationale for asymmetry: catalog sometimes DOES include these (e.g.
// "STOLI VODKA"), and the asymmetric strip preserves the information gap
// between "Stoli Lime Vodka" (scraped, strip vodka → {stoli, lime}) and
// "STOLI VODKA" (catalog, keep → {stoli, vodka}) — jaccard 0.333, rejected.
// Symmetric strip would collapse to {stoli, lime} vs {stoli} and falsely
// match Stoli Lime to plain Stoli at 0.5.
const CATEGORY_TOKENS = new Set([
  "tequila",
  "vodka",
  "rum",
  "gin",
  "whisky",
  "whiskey",
  "bourbon",
  "scotch",
  "cognac",
  "brandy",
  "mezcal",
  "liqueur",
  "liquor",
  "wine",
  // v2 expansion — review-matches.ts surfaced these as category words
  // causing cross-brand false positives in the 0.50-0.75 token_overlap tier
  // (e.g. Bordiga Vermouth → Vya Extra Dry Vermouth).
  "vermouth",
  "champagne",
  "prosecco",
  "cava",
  "sake",
  "cider",
  "seltzer",
]);

// DESCRIPTOR_TOKENS — connective-tissue words that appear in BOTH scraped
// titles and POS canonical_name ("GLEN SCOTIA SINGLE MALT 10YR") and are
// never the feature that distinguishes one product from another within a
// real brand. Stripped symmetrically (both sides) so they don't bridge
// unrelated products like Laphroaig 10yr and Glen Scotia 10yr via their
// shared "single malt" descriptors.
//
// Kept tight on purpose. "bonded", "reserve", "triple", "mash" are NOT
// here — those are genuine sub-SKU differentiators (Jack Daniel's Bonded
// vs Bonded Triple Mash are different products on the shelf).
const DESCRIPTOR_TOKENS = new Set([
  "single",
  "malt",
  "blended",
  "straight",
  "flavored",
]);

function stripScrapedCategoryWords(s: string): string {
  return s
    .replace(/\b(?:red|white|rose|rosé)\s+wine\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scrapedTokenSet(coreName: string): Set<string> {
  // Defensive decode — new scrapes get entity-clean names at parse time, but
  // existing products-scraped.ndjson rows from the pre-fix scrape still have
  // "&amp;" and "&#39;" in them. Running decode here keeps matching correct
  // for both.
  const decoded = decodeHtmlEntities(coreName);
  const cleaned = stripScrapedCategoryWords(decoded);
  const out = new Set<string>();
  for (const t of normalize(cleaned).split(/\s+/)) {
    if (t.length < 2) continue;
    if (CATEGORY_TOKENS.has(t)) continue;
    if (DESCRIPTOR_TOKENS.has(t)) continue;
    out.add(t);
  }
  return out;
}

// Catalog-side token set for fuzzy matching. Strips DESCRIPTOR_TOKENS only
// (not CATEGORY_TOKENS — see CATEGORY_TOKENS comment for why that strip has
// to stay asymmetric). Used by the match phase's tier-4 Jaccard scorer.
function catalogTokenSet(coreName: string): Set<string> {
  const out = new Set<string>();
  for (const t of normalize(coreName).split(/\s+/)) {
    if (t.length < 2) continue;
    if (DESCRIPTOR_TOKENS.has(t)) continue;
    out.add(t);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ---------------------------------------------------------------------------
// HTML entity decoder
//
// HTML attributes and meta content can contain named entities (&amp; &quot;),
// decimal numeric refs (&#39;), and hex refs (&#x27;). If we leave these in
// the scraped name, our tokenizer produces junk tokens like "amp" or "39"
// that dilute Jaccard similarity and hurt match quality. This handles the
// small set that actually appears on City Hive product pages — not a full
// HTML5 entity table, but enough.
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "…",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  copy: "",
  reg: "",
  trade: "",
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (_, name) => {
      const v = NAMED_ENTITIES[name.toLowerCase()];
      return v !== undefined ? v : `&${name};`;
    });
}

// ---------------------------------------------------------------------------
// City Hive HTML patterns (stable across every storefront on the platform)
// ---------------------------------------------------------------------------

// The image URL pattern is stable across City Hive storefronts. Grab the
// first one we see that matches /products/<24-hex>/<size>.<ext>.
const IMG_RE =
  /https?:\/\/cityhive-production-cdn\.cityhive\.net\/products\/([a-f0-9]{24})\/(?:large|medium|original|small)\.(?:png|jpg|jpeg|webp)/i;
// Prefer og:image (it's the canonical representation). Fall back to body.
const OG_IMG_RE = /<meta[^>]+property=(?:"|')og:image(?:"|')[^>]+content=(?:"|')([^"']+)(?:"|')/i;
const TITLE_RE = /<title>([\s\S]*?)<\/title>/i;
const OG_TITLE_RE = /<meta[^>]+property=(?:"|')og:title(?:"|')[^>]+content=(?:"|')([^"']+)(?:"|')/i;
const OG_DESC_RE = /<meta[^>]+property=(?:"|')og:description(?:"|')[^>]+content=(?:"|')([^"']+)(?:"|')/i;
const META_DESC_RE = /<meta[^>]+name=(?:"|')description(?:"|')[^>]+content=(?:"|')([^"']+)(?:"|')/i;
// City Hive price appears in JSON-LD or as data-price attribute. Regex
// matches either "price": "39.99" in JSON-LD or data-price="39.99".
const PRICE_RE = /(?:"price"\s*:\s*"?|data-price=(?:"|'))(\d+(?:\.\d+)?)/i;

// ---------------------------------------------------------------------------
// Per-retailer path helpers
// ---------------------------------------------------------------------------

type Paths = {
  outDir: string;
  sitemap: string;
  indexed: string;
  scraped: string;
  matches: string;
  summary: string;
};

function pathsFor(config: CityHiveConfig): Paths {
  const outDir = path.join("scripts", "eval-results", config.retailerSlug);
  return {
    outDir,
    sitemap: path.join(outDir, "sitemap.html"),
    indexed: path.join(outDir, "products-indexed.ndjson"),
    scraped: path.join(outDir, "products-scraped.ndjson"),
    matches: path.join(outDir, "matches.ndjson"),
    summary: path.join(outDir, "summary.json"),
  };
}

// ---------------------------------------------------------------------------
// Phase 1: INDEX — fetch sitemap, extract product URLs
// ---------------------------------------------------------------------------

async function phaseIndex(
  config: CityHiveConfig,
  args: Args,
  paths: Paths,
  log: (msg: string) => void,
): Promise<IndexedProduct[]> {
  log("\nphase 1: INDEX");

  if (!args.force && existsSync(paths.indexed)) {
    const existing = readNdjson<IndexedProduct>(paths.indexed);
    log(`  [skip] ${paths.indexed} exists with ${existing.length} products (use --force to redo)`);
    return existing;
  }

  const sitemapUrl = `${config.baseUrl.replace(/\/+$/, "")}/sitemap.html`;
  if (args.force || !existsSync(paths.sitemap)) {
    log(`  [fetch] ${sitemapUrl}`);
    const html = await fetchHtml(sitemapUrl);
    writeFileSync(paths.sitemap, html);
    log(`  [save ] ${paths.sitemap} (${html.length.toLocaleString()} bytes)`);
  }

  const html = readFileSync(paths.sitemap, "utf-8");
  // Matches href="https://<host>/shop/product/<slug>/<24-hex>?..." AND
  // matches relative /shop/product/... in case they use root-relative URLs.
  // The City Hive product-URL shape is identical across every storefront —
  // only the host varies, so we convert relatives using config.baseUrl.
  const re =
    /href=(?:"|')((?:https?:\/\/[^"'\s]+)?\/shop\/product\/([^/"'\s]+)\/([a-f0-9]{24})[^"'\s]*)(?:"|')/gi;
  const seen = new Map<string, IndexedProduct>();
  const baseHost = config.baseUrl.replace(/\/+$/, "");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const full = m[1];
    const slug = m[2];
    const productId = m[3];
    if (seen.has(productId)) continue;
    const absUrl = full.startsWith("http")
      ? full
      : `${baseHost}${full.startsWith("/") ? full : `/${full}`}`;
    // Strip query string from stored URL so we scrape one canonical version
    const cleanUrl = absUrl.split("?")[0];
    seen.set(productId, { product_id: productId, slug, url: cleanUrl });
  }

  const products = Array.from(seen.values());
  if (products.length === 0) {
    console.warn("  [warn ] zero products extracted — did the sitemap structure change?");
  }

  // Overwrite indexed file with fresh list
  writeFileSync(paths.indexed, "");
  for (const p of products) appendNdjson(paths.indexed, p);
  log(`  [done ] indexed ${products.length} unique products → ${paths.indexed}`);
  return products;
}

// ---------------------------------------------------------------------------
// Phase 2: SCRAPE — fetch each product page, extract image URL + name
// ---------------------------------------------------------------------------

function parseProductPage(html: string, indexed: IndexedProduct): ScrapedProduct | null {
  // Title — try og:title first (cleaner), then <title>
  let name = "";
  const ogTitle = html.match(OG_TITLE_RE);
  if (ogTitle) name = ogTitle[1].trim();
  if (!name) {
    const t = html.match(TITLE_RE);
    if (t) name = t[1].trim();
  }
  // Strip site-name suffix that sometimes trails titles (e.g. " | Store Name").
  // Conservative: only trim after a pipe/dash if the trailing text is short
  // (<= 50 chars) — otherwise we'd accidentally chop real product-name fragments.
  name = name.replace(/\s*[|\-–—]\s*[^|\-–—]{1,50}$/i, "").trim();
  if (!name) {
    // Fall back to slug-based name (hyphens → spaces, title-case)
    name = indexed.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  // Decode HTML entities BEFORE tokenization. Otherwise "Smirnoff Red White
  // &amp; Berry" yields an "amp" token and "Edmund&#39;s" yields "39" —
  // both dilute Jaccard similarity and cause weaker matches.
  name = decodeHtmlEntities(name);

  // Image URL — og:image first (most canonical), then any body match
  let imageUrl: string | null = null;
  const ogImg = html.match(OG_IMG_RE);
  if (ogImg && IMG_RE.test(ogImg[1])) imageUrl = ogImg[1];
  if (!imageUrl) {
    const bodyMatch = html.match(IMG_RE);
    if (bodyMatch) imageUrl = bodyMatch[0];
  }
  if (!imageUrl) return null;

  const imgIdMatch = imageUrl.match(/\/products\/([a-f0-9]{24})\//);
  const imageId = imgIdMatch ? imgIdMatch[1] : "";

  const sizeMl = parseSizeMlFromName(name);
  const packCount = parsePackCount(name);
  const coreName = extractCoreName(name);

  // Brand guess: City Hive product pages often have the brand as the first
  // 1-3 words of the product name. We store this as a weak signal; the
  // matcher falls back to core_name + size_ml when brand is wrong.
  const words = coreName.split(/\s+/).filter(Boolean);
  const brandGuess = words.length >= 1 ? words[0] : null;

  // Description — prefer og:description, fall back to meta[name=description].
  // Stored raw (entities decoded) for the future tasting-notes enrichment pass.
  let description: string | null = null;
  const ogDesc = html.match(OG_DESC_RE);
  if (ogDesc) description = decodeHtmlEntities(ogDesc[1].trim());
  if (!description) {
    const md = html.match(META_DESC_RE);
    if (md) description = decodeHtmlEntities(md[1].trim());
  }
  if (description && description.length === 0) description = null;

  // Price — best-effort regex. City Hive renders it as JSON-LD or as a
  // data-price attribute. Either way we want a plain number in USD.
  let priceUsd: number | null = null;
  const priceMatch = html.match(PRICE_RE);
  if (priceMatch) {
    const p = parseFloat(priceMatch[1]);
    if (Number.isFinite(p) && p > 0 && p < 100000) priceUsd = p;
  }

  return {
    ...indexed,
    name,
    image_url: imageUrl,
    image_id: imageId,
    size_ml: sizeMl,
    pack_count: packCount,
    core_name: coreName,
    brand_guess: brandGuess,
    description,
    price_usd: priceUsd,
    scraped_at: new Date().toISOString(),
  };
}

async function phaseScrape(
  args: Args,
  paths: Paths,
  indexed: IndexedProduct[],
  log: (msg: string) => void,
): Promise<ScrapedProduct[]> {
  log("\nphase 2: SCRAPE");

  // Load any existing scraped products so we can resume
  const existing = readNdjson<ScrapedProduct>(paths.scraped);
  const existingIds = new Set(existing.map((s) => s.product_id));

  if (!args.force && existing.length > 0) {
    log(`  [resume] ${existing.length} already scraped; skipping those`);
  } else if (args.force) {
    writeFileSync(paths.scraped, "");
    existingIds.clear();
  }

  let todo = indexed.filter((p) => !existingIds.has(p.product_id));
  if (args.limit != null) todo = todo.slice(0, args.limit);
  log(`  [plan  ] ${todo.length} product pages to fetch`);

  const all: ScrapedProduct[] = [...existing];
  let hits = 0;
  let misses = 0;
  let errors = 0;

  for (let i = 0; i < todo.length; i++) {
    const p = todo[i];
    try {
      const html = await fetchHtml(p.url);
      const scraped = parseProductPage(html, p);
      if (scraped) {
        appendNdjson(paths.scraped, scraped);
        all.push(scraped);
        hits++;
        if (args.verbose) {
          log(
            `  [hit ] ${scraped.name.slice(0, 50).padEnd(50)} → ${scraped.image_url.slice(-60)}`,
          );
        }
      } else {
        misses++;
        if (args.verbose) log(`  [miss] ${p.slug} (no image URL in HTML)`);
      }
    } catch (e) {
      errors++;
      console.warn(`  [err ] ${p.slug}: ${(e as Error).message}`);
    }
    if ((i + 1) % 100 === 0) {
      log(`  [prog ] ${i + 1}/${todo.length} hits=${hits} misses=${misses} errors=${errors}`);
    }
    if (args.throttleMs > 0 && i < todo.length - 1) await sleep(args.throttleMs);
  }

  log(
    `  [done ] scraped ${hits} new (total ${all.length}), ${misses} missing image, ${errors} errors`,
  );
  return all;
}

// ---------------------------------------------------------------------------
// Phase 3: MATCH — find catalog_products rows that correspond to scraped products
// ---------------------------------------------------------------------------

async function phaseMatch(
  args: Args,
  paths: Paths,
  scraped: ScrapedProduct[],
  log: (msg: string) => void,
): Promise<Match[]> {
  log("\nphase 3: MATCH");

  if (!args.force && existsSync(paths.matches)) {
    const existing = readMatchesNdjson(paths.matches);
    log(`  [skip ] ${paths.matches} exists with ${existing.length} matches (use --force to redo)`);
    return existing;
  }

  const dbUrl = requireDbUrl();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  writeFileSync(paths.matches, "");
  const matches: Match[] = [];
  let byFingerprint = 0;
  let byCoreSize = 0;
  let byCoreOnly = 0;
  let byTokenOverlap = 0;
  let noMatch = 0;

  try {
    // Pre-index every catalog product that still needs an image. Single query,
    // avoids 6k round-trips. Map by fingerprint AND by (core_name + size_ml)
    // for the fallback match.
    const res = await client.query<{
      id: string;
      fingerprint: string;
      canonical_name: string;
      brand: string | null;
      size_ml: number | null;
      pack_count: number;
    }>(`
      select id::text, fingerprint, canonical_name, brand, size_ml, pack_count
        from public.catalog_products
       where image_url is null
    `);
    log(`  [load ] ${res.rows.length} catalog rows need an image`);

    const byFp = new Map<string, typeof res.rows[number]>();
    const byCoreSizeKey = new Map<string, typeof res.rows[number][]>();
    const byCoreOnlyKey = new Map<string, typeof res.rows[number][]>();
    // Tier-4 buckets: keyed by each token of the normalized catalog brand.
    // For scraped "Familia Camarena Tequila Anejo" (tokens: familia, camarena,
    // tequila, anejo) we look up every bucket matching one of those tokens —
    // the Camarena brand bucket fires on "camarena" — and score each
    // candidate by Jaccard similarity.
    const byBrandTokenKey = new Map<string, typeof res.rows[number][]>();
    const tokensById = new Map<string, Set<string>>();
    for (const r of res.rows) {
      byFp.set(r.fingerprint, r);
      const core = normalize(extractCoreName(r.canonical_name));
      const sizeKey = `${core}|${r.size_ml ?? "nosize"}`;
      const sizeBucket = byCoreSizeKey.get(sizeKey) ?? [];
      sizeBucket.push(r);
      byCoreSizeKey.set(sizeKey, sizeBucket);

      // Third-tier fallback: core_name only, ignoring size entirely. Used
      // when the retailer's product title doesn't include size (common —
      // "750ML" is default and often omitted). Only commits a match when
      // exactly ONE catalog row has that core_name, otherwise we'd risk
      // attaching a 750ml bottle image to a 375ml SKU or vice versa.
      const onlyBucket = byCoreOnlyKey.get(core) ?? [];
      onlyBucket.push(r);
      byCoreOnlyKey.set(core, onlyBucket);

      // Tier-4 precompute: catalog token set (for Jaccard) and brand-token
      // inverted index (for cheap candidate generation). catalogTokenSet
      // strips DESCRIPTOR_TOKENS symmetrically so "single", "malt" etc.
      // don't inflate the Jaccard score for cross-brand bridges.
      tokensById.set(r.id, catalogTokenSet(extractCoreName(r.canonical_name)));
      const brandNorm = normalize(r.brand ?? "");
      if (brandNorm) {
        for (const tok of brandNorm.split(/\s+/)) {
          if (tok.length < 2) continue;
          const bucket = byBrandTokenKey.get(tok) ?? [];
          bucket.push(r);
          byBrandTokenKey.set(tok, bucket);
        }
      }
    }

    const input = args.limit != null ? scraped.slice(0, args.limit) : scraped;
    for (const s of input) {
      // Try the strict fingerprint match first. Since brand_guess is weak,
      // we try a few brand variants: the guess, no brand, and first-two words.
      const brandVariants: (string | null)[] = [
        s.brand_guess,
        null,
        // If the name has multiple words, try first-two as a compound brand
        // ("Casa Del Sol" vs single word "Casa").
        s.core_name.split(/\s+/).slice(0, 2).join(" ") || null,
      ];

      let hit: Match | null = null;

      for (const brand of brandVariants) {
        const fp = computeFingerprint(brand, s.core_name, s.size_ml, s.pack_count);
        const row = byFp.get(fp);
        if (row) {
          hit = {
            cityhive_product_id: s.product_id,
            cityhive_name: s.name,
            cityhive_image_url: s.image_url,
            catalog_product_id: row.id,
            catalog_canonical_name: row.canonical_name,
            match_type: "fingerprint",
            match_score: 1.0,
          };
          break;
        }
      }

      const core = normalize(s.core_name);

      if (!hit) {
        // Tier 2: (core_name + size_ml). Exact size match, but brand-agnostic.
        // Only commit if exactly one catalog row has that combo.
        const key = `${core}|${s.size_ml ?? "nosize"}`;
        const bucket = byCoreSizeKey.get(key) ?? [];
        if (bucket.length === 1) {
          const row = bucket[0];
          hit = {
            cityhive_product_id: s.product_id,
            cityhive_name: s.name,
            cityhive_image_url: s.image_url,
            catalog_product_id: row.id,
            catalog_canonical_name: row.canonical_name,
            match_type: "core_name_size",
            match_score: 0.9,
          };
        }
      }

      if (!hit) {
        // Tier 3: core_name alone. Used when the retailer's title omits the
        // size (the common case — most products are 750ml and retailers omit
        // that as implied). Only commit when exactly one catalog row shares
        // this core_name, so we can't accidentally attach the 750ml image to
        // the 375ml SKU.
        const bucket = byCoreOnlyKey.get(core) ?? [];
        if (bucket.length === 1) {
          const row = bucket[0];
          hit = {
            cityhive_product_id: s.product_id,
            cityhive_name: s.name,
            cityhive_image_url: s.image_url,
            catalog_product_id: row.id,
            catalog_canonical_name: row.canonical_name,
            match_type: "core_name_only",
            match_score: 0.75,
          };
        }
      }

      if (!hit) {
        // Tier 4: token-set Jaccard similarity with brand pre-filter.
        //
        // Needed because the catalog's `canonical_name` is POS-style
        // shorthand ("CAMARENA ANEJO"), while retailer titles are full
        // marketing strings ("Familia Camarena Tequila Anejo"). Exact-match
        // tiers never fire for those pairs even though they're the same
        // product.
        //
        // Algorithm:
        //   1. Tokenize scraped core_name (drop tokens < 2 chars).
        //   2. For every scraped token, look up catalog rows whose brand
        //      contains that token (inverted index built above).
        //   3. Score each candidate by Jaccard similarity of core tokens.
        //   4. Require size_ml agreement (or either-side null).
        //   5. Commit only if top score >= 0.5 AND top beats #2 by >= 0.1
        //      — ambiguous winners are rejected to avoid attaching the
        //      wrong-expression image (e.g. confusing an anejo for a
        //      reposado of the same brand).
        const scrapedTokens = scrapedTokenSet(s.core_name);
        if (scrapedTokens.size >= 2) {
          const candIds = new Set<string>();
          const candidates: typeof res.rows[number][] = [];
          for (const tok of scrapedTokens) {
            const bucket = byBrandTokenKey.get(tok);
            if (!bucket) continue;
            for (const r of bucket) {
              if (candIds.has(r.id)) continue;
              candIds.add(r.id);
              candidates.push(r);
            }
          }

          type Cand = { row: typeof res.rows[number]; score: number };
          const scored: Cand[] = [];
          for (const r of candidates) {
            // Size guard: if both sides declare size and they disagree, reject
            // outright. If either side is null, we allow it (POS inventory
            // often omits size when it's the implied-default 750ml).
            if (r.size_ml != null && s.size_ml != null && r.size_ml !== s.size_ml) continue;
            const catTokens = tokensById.get(r.id);
            if (!catTokens) continue;
            const score = jaccard(scrapedTokens, catTokens);
            if (score >= 0.5) scored.push({ row: r, score });
          }
          scored.sort((a, b) => b.score - a.score);
          if (scored.length > 0) {
            const top = scored[0];
            const runnerUp = scored[1];
            if (!runnerUp || top.score - runnerUp.score >= 0.1) {
              hit = {
                cityhive_product_id: s.product_id,
                cityhive_name: s.name,
                cityhive_image_url: s.image_url,
                catalog_product_id: top.row.id,
                catalog_canonical_name: top.row.canonical_name,
                match_type: "token_overlap",
                match_score: top.score,
              };
            }
          }
        }
      }

      if (hit) {
        matches.push(hit);
        appendNdjson(paths.matches, hit);
        if (hit.match_type === "fingerprint") byFingerprint++;
        else if (hit.match_type === "core_name_size") byCoreSize++;
        else if (hit.match_type === "core_name_only") byCoreOnly++;
        else byTokenOverlap++;
        if (args.verbose) {
          const tag =
            hit.match_type === "fingerprint"
              ? "fp  "
              : hit.match_type === "core_name_size"
                ? "core"
                : hit.match_type === "core_name_only"
                  ? "name"
                  : "tok ";
          const scoreStr =
            hit.match_type === "token_overlap" ? ` (${hit.match_score.toFixed(2)})` : "";
          log(
            `  [${tag}] ${s.name.slice(0, 50).padEnd(50)} → ${hit.catalog_canonical_name.slice(0, 40)}${scoreStr}`,
          );
        }
      } else {
        noMatch++;
        if (args.verbose) {
          log(`  [none] ${s.name.slice(0, 50).padEnd(50)} core="${core.slice(0, 40)}"`);
        }
      }
    }
  } finally {
    await client.end();
  }

  log(
    `  [done ] fingerprint=${byFingerprint} core_size=${byCoreSize} core_only=${byCoreOnly} token=${byTokenOverlap} unmatched=${noMatch} total=${matches.length}`,
  );
  return matches;
}

// ---------------------------------------------------------------------------
// Phase 4: APPLY — write matched image URLs to catalog_products
// ---------------------------------------------------------------------------

async function phaseApply(
  config: CityHiveConfig,
  args: Args,
  matches: Match[],
  log: (msg: string) => void,
): Promise<void> {
  log("\nphase 4: APPLY");

  // Gate the fuzzy tier by confidence. Exact-tier matches always pass;
  // token_overlap below the threshold is dropped here (not deleted from
  // matches.ndjson — the file is kept intact for v2 re-processing).
  const before = matches.length;
  matches = matches.filter(
    (m) => m.match_type !== "token_overlap" || m.match_score >= args.minTokenScore,
  );
  const dropped = before - matches.length;
  if (dropped > 0) {
    log(
      `  [filter] dropped ${dropped} token_overlap matches below --min-token-score=${args.minTokenScore}`,
    );
  }
  log(`  [plan ] ${matches.length} catalog rows would be updated`);

  if (!args.write) {
    log("  [dry  ] DRY RUN — re-run with --write to commit.");
    log("  [dry  ] sample (first 5):");
    for (const m of matches.slice(0, 5)) {
      log(
        `    ${m.catalog_canonical_name.slice(0, 40).padEnd(40)} ← ${m.cityhive_image_url.slice(-70)}`,
      );
    }
    return;
  }

  const dbUrl = requireDbUrl();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  let updated = 0;
  let skipped = 0;
  const batchSize = 200;
  try {
    for (let i = 0; i < matches.length; i += batchSize) {
      const batch = matches.slice(i, i + batchSize);
      // unnest pattern: one query for N rows
      const ids = batch.map((m) => m.catalog_product_id);
      const urls = batch.map((m) => m.cityhive_image_url);
      const r = await client.query(
        `
        update public.catalog_products cat
           set image_url           = data.url,
               image_source        = $3::text,
               image_quality_score = 3,
               enriched_at         = coalesce(cat.enriched_at, now()),
               updated_at          = now()
          from (
            select unnest($1::uuid[]) as id, unnest($2::text[]) as url
          ) data
         where cat.id = data.id
           and cat.image_url is null
        `,
        [ids, urls, config.imageSource],
      );
      updated += r.rowCount ?? 0;
      skipped += batch.length - (r.rowCount ?? 0);
      if ((i / batchSize) % 5 === 0) {
        log(
          `  [prog ] ${Math.min(i + batchSize, matches.length)}/${matches.length} updated=${updated} skipped=${skipped}`,
        );
      }
    }
  } finally {
    await client.end();
  }
  log(
    `  [done ] committed ${updated} image_url updates. ${skipped} skipped (already had image).`,
  );
}

// ---------------------------------------------------------------------------
// Orchestration — public entry point for per-retailer scripts
// ---------------------------------------------------------------------------

export async function runCityHivePipeline(
  config: CityHiveConfig,
  args: Args,
): Promise<void> {
  loadDotenv();
  const paths = pathsFor(config);
  mkdirSync(paths.outDir, { recursive: true });
  const logTag = config.logTag ?? config.retailerSlug;
  const log = (msg: string) => console.log(`[${logTag}]${msg.startsWith("\n") ? msg : " " + msg}`);
  const startedAt = new Date().toISOString();

  log(`scrape-${config.retailerSlug} (${config.displayName}) starting`);
  log(
    `  ${JSON.stringify({
      phase: args.phase,
      write: args.write,
      limit: args.limit,
      throttleMs: args.throttleMs,
      force: args.force,
      minTokenScore: args.minTokenScore,
    })}`,
  );

  let indexed: IndexedProduct[] = [];
  let scraped: ScrapedProduct[] = [];
  let matches: Match[] = [];

  if (args.phase === "index" || args.phase === "all") {
    indexed = await phaseIndex(config, args, paths, log);
  } else {
    indexed = readNdjson<IndexedProduct>(paths.indexed);
    log(`loaded ${indexed.length} indexed from file (skipping index phase)`);
  }

  if (args.phase === "scrape" || args.phase === "all") {
    scraped = await phaseScrape(args, paths, indexed, log);
  } else if (args.phase === "match" || args.phase === "apply") {
    scraped = readNdjson<ScrapedProduct>(paths.scraped);
    log(`loaded ${scraped.length} scraped from file (skipping scrape phase)`);
  }

  if (args.phase === "match" || args.phase === "all") {
    matches = await phaseMatch(args, paths, scraped, log);
  } else if (args.phase === "apply") {
    matches = readMatchesNdjson(paths.matches);
    log(`loaded ${matches.length} matches from file (skipping match phase)`);
  }

  if (args.phase === "apply" || args.phase === "all") {
    await phaseApply(config, args, matches, log);
  }

  const summary = {
    retailer_slug: config.retailerSlug,
    display_name: config.displayName,
    base_url: config.baseUrl,
    image_source: config.imageSource,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    phase: args.phase,
    indexed_count: indexed.length,
    scraped_count: scraped.length,
    match_count: matches.length,
    write: args.write,
  };
  writeFileSync(paths.summary, JSON.stringify(summary, null, 2));
  log(`done ${JSON.stringify(summary)}`);
}
