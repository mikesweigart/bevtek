/**
 * diag-match — for each scraped product, show WHY it didn't match.
 * Dumps the top 10 Jaccard candidates from the catalog so we can see
 * if the matcher is missing valid hits or correctly rejecting ambiguity.
 *
 * Run in the PowerShell that has SUPABASE_DB_URL set:
 *   pnpm tsx scripts/diag-match.ts
 */
import process from "node:process";
import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

// Minimal .env.local loader — see scrape-grapes-and-grains.ts for rationale.
function loadDotenv(): void {
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
loadDotenv();

// Copy of helpers from the scrape script. Must stay in sync.
function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\*dnr\*/gi, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function tokenSet(s: string): Set<string> {
  const out = new Set<string>();
  for (const t of normalize(s).split(/\s+/)) {
    if (t.length >= 2) out.add(t);
  }
  return out;
}

const CATEGORY_TOKENS = new Set([
  "tequila","vodka","rum","gin","whisky","whiskey","bourbon","scotch",
  "cognac","brandy","mezcal","liqueur","liquor","wine",
]);

function stripScrapedCategoryWords(s: string): string {
  return s.replace(/\b(?:red|white|rose|rosé)\s+wine\b/gi, " ").replace(/\s+/g, " ").trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "-", mdash: "-", hellip: "…", rsquo: "'", lsquo: "'",
  rdquo: '"', ldquo: '"', copy: "", reg: "", trade: "",
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

function scrapedTokenSet(coreName: string): Set<string> {
  const decoded = decodeHtmlEntities(coreName);
  const cleaned = stripScrapedCategoryWords(decoded);
  const out = new Set<string>();
  for (const t of normalize(cleaned).split(/\s+/)) {
    if (t.length < 2) continue;
    if (CATEGORY_TOKENS.has(t)) continue;
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

type Scraped = {
  name: string;
  core_name: string;
  size_ml: number | null;
};

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }
  const scrapedPath = "scripts/eval-results/grapes-and-grains/products-scraped.ndjson";
  if (!existsSync(scrapedPath)) {
    console.error(`Missing ${scrapedPath}`);
    process.exit(1);
  }
  const scraped: Scraped[] = readFileSync(scrapedPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const res = await client.query<{
      id: string;
      canonical_name: string;
      brand: string | null;
      size_ml: number | null;
    }>(`
      select id::text, canonical_name, brand, size_ml
        from public.catalog_products
       where image_url is null
    `);
    console.log(`loaded ${res.rows.length} catalog rows with null image_url`);

    // Precompute tokens and brand buckets
    const tokensById = new Map<string, Set<string>>();
    const byBrandTokenKey = new Map<string, typeof res.rows[number][]>();
    for (const r of res.rows) {
      tokensById.set(r.id, tokenSet(extractCoreName(r.canonical_name)));
      const brandNorm = normalize(r.brand ?? "");
      if (!brandNorm) continue;
      for (const tok of brandNorm.split(/\s+/)) {
        if (tok.length < 2) continue;
        const bucket = byBrandTokenKey.get(tok) ?? [];
        bucket.push(r);
        byBrandTokenKey.set(tok, bucket);
      }
    }

    for (const s of scraped) {
      console.log("\n" + "=".repeat(80));
      console.log(`SCRAPED: "${s.name}" (size_ml=${s.size_ml})`);
      const st = scrapedTokenSet(s.core_name);
      console.log(`  tokens: {${Array.from(st).join(", ")}}`);

      const candIds = new Set<string>();
      const candidates: typeof res.rows[number][] = [];
      for (const tok of st) {
        const bucket = byBrandTokenKey.get(tok);
        if (!bucket) continue;
        for (const r of bucket) {
          if (candIds.has(r.id)) continue;
          candIds.add(r.id);
          candidates.push(r);
        }
      }
      console.log(`  brand-filter candidate pool: ${candidates.length} rows`);

      if (candidates.length === 0) {
        // No brand hit. Let's check if the catalog has ANY row mentioning the
        // strongest scraped token.
        const distinctTok = Array.from(st).find(
          (t) => !["red", "white", "wine", "box", "vodka", "rum", "gin", "dark"].includes(t),
        );
        if (distinctTok) {
          const probe = await client.query(
            `select canonical_name, brand, size_ml
               from public.catalog_products
              where lower(canonical_name) like $1 or lower(coalesce(brand,'')) like $1
              limit 5`,
            [`%${distinctTok}%`],
          );
          console.log(
            `  [probe] catalog rows containing "${distinctTok}": ${probe.rowCount}`,
          );
          for (const r of probe.rows) {
            console.log(`    ${r.canonical_name} (brand=${r.brand}, size=${r.size_ml})`);
          }
        }
        continue;
      }

      // Score every candidate, honoring size guard
      type Cand = {
        row: typeof res.rows[number];
        score: number;
        sizeOk: boolean;
      };
      const scored: Cand[] = candidates.map((r) => {
        const sizeOk = !(r.size_ml != null && s.size_ml != null && r.size_ml !== s.size_ml);
        const ct = tokensById.get(r.id)!;
        return { row: r, score: jaccard(st, ct), sizeOk };
      });
      scored.sort((a, b) => b.score - a.score);
      console.log("  top 10 (score, sizeOk, canonical_name, size_ml):");
      for (const c of scored.slice(0, 10)) {
        console.log(
          `    ${c.score.toFixed(3)}  ${c.sizeOk ? "OK " : "XXX"}  ${c.row.canonical_name.slice(0, 50).padEnd(50)} ${c.row.size_ml ?? "null"}`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
