/**
 * promote-inventory-images — lift high-confidence images from inventory to
 * catalog_products, skipping known-bad sources.
 *
 * After build-catalog-products linked every inventory row to a catalog row,
 * `catalog_products.image_url` is all NULL. Some `inventory.image_url`
 * values are real (brand-CDN photos), others are placeholders or wrong-match
 * Wikipedia scrapes. We only want to promote the good ones.
 *
 * CLASSIFICATION (see `classifyUrl`):
 *   - placeholder   → SKIP. Literal `/bottle-coming-soon.svg` etc.
 *   - wikimedia     → SKIP by default. upload.wikimedia.org has a demonstrated
 *                     false-positive rate (keyword matches on unrelated articles
 *                     — a wine named "Barkan" got a shopping-mall photo).
 *                     Use --include-wikimedia if you want it anyway.
 *   - brand_cdn     → PROMOTE. URL host contains a token from the row's brand
 *                     name (e.g. "deschutesbrewery.com" for brand "Deschutes").
 *                     Highest confidence — the brand publishes these.
 *   - supabase      → PROMOTE. Self-hosted (from staff-upload flow).
 *   - other         → PROMOTE with lower quality score. Unknown external URL —
 *                     could be legit retailer photo or random image; the UI
 *                     can prefer higher-scored alternatives when available.
 *
 * DEDUP: many inventory rows can point to the same catalog row. We pick the
 * single best candidate per catalog_product_id (brand_cdn > supabase > other).
 *
 * IDEMPOTENT: only writes to catalog rows where image_url is NULL. Re-running
 * never clobbers a curated image.
 *
 * USAGE:
 *   pnpm image:promote                   # dry run
 *   pnpm image:promote:analyze           # stats only, no iteration over rows
 *   pnpm image:promote -- --write        # commit
 *   pnpm image:promote -- --write --verbose
 *   pnpm image:promote -- --include-wikimedia --write   # if you trust it
 */

import process from "node:process";
import { Client } from "pg";

type Args = {
  write: boolean;
  analyzeOnly: boolean;
  includeWikimedia: boolean;
  verbose: boolean;
  limit: number | null;
};

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const args: Args = {
    write: false,
    analyzeOnly: false,
    includeWikimedia: false,
    verbose: false,
    limit: null,
  };
  for (const a of raw) {
    if (a === "--") continue;
    if (a === "--write") args.write = true;
    else if (a === "--analyze-only") args.analyzeOnly = true;
    else if (a === "--include-wikimedia") args.includeWikimedia = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a === "--help" || a === "-h") {
      console.log(
        "promote-inventory-images — lift good inventory images into catalog_products\n" +
          "  --write                Commit (otherwise dry run)\n" +
          "  --analyze-only         Print stats only, don't iterate for dedup\n" +
          "  --include-wikimedia    Opt in to Wikimedia URLs (high false-positive risk)\n" +
          "  --limit=<n>            Process at most N inventory rows (testing)\n" +
          "  --verbose              Print every per-row decision\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

type Row = {
  inv_id: string;
  store_id: string;
  image_url: string;
  image_source: string | null;
  brand: string | null;
  catalog_product_id: string;
  catalog_name: string;
  catalog_image_url: string | null;
};

type Classification =
  | "placeholder"
  | "wikimedia"
  | "brand_cdn"
  | "supabase"
  | "other";

function classifyUrl(url: string, brand: string | null): Classification {
  const u = url.trim().toLowerCase();
  // Relative paths served by the web app — placeholders, not real images.
  if (u.startsWith("/") || u.includes("bottle-coming-soon") || u.includes("placeholder")) {
    return "placeholder";
  }
  if (u.includes("upload.wikimedia.org") || u.includes("wikipedia.org/")) {
    return "wikimedia";
  }
  // Supabase Storage URL pattern (either *.supabase.co/storage or self-hosted).
  if (u.includes("supabase.co/storage") || u.includes("/storage/v1/object/")) {
    return "supabase";
  }
  // Brand CDN heuristic: tokenize the brand name and check if any token
  // (longer than 3 chars) appears in the URL host. Catches deschutesbrewery.com
  // for "Deschutes", smirnoff.com for "Smirnoff", etc.
  if (brand) {
    const hostMatch = u.match(/^https?:\/\/([^/]+)/);
    const host = hostMatch ? hostMatch[1] : "";
    const tokens = brand
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(/\s+/)
      .filter((t) => t.length >= 4);
    if (tokens.some((t) => host.includes(t))) {
      return "brand_cdn";
    }
  }
  return "other";
}

// Promotion priority: brand_cdn (highest) > supabase > other > wikimedia > placeholder (never)
const PRIORITY: Record<Classification, number> = {
  brand_cdn: 4,
  supabase: 3,
  other: 2,
  wikimedia: 1,
  placeholder: 0,
};

const QUALITY_SCORE: Record<Classification, number> = {
  brand_cdn: 3,
  supabase: 2,
  wikimedia: 1,
  other: 1,
  placeholder: 0,
};

async function main() {
  const args = parseArgs();
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Fetch every candidate row: inventory with image_url AND linked to a
    // catalog row. We INCLUDE catalog rows that already have an image so
    // they can still be counted in the dry-run stats (but they get skipped
    // during the write).
    let sql = `
      select
        inv.id::text           as inv_id,
        inv.store_id::text     as store_id,
        inv.image_url          as image_url,
        inv.image_source       as image_source,
        inv.brand              as brand,
        inv.catalog_product_id::text as catalog_product_id,
        cat.canonical_name     as catalog_name,
        cat.image_url          as catalog_image_url
      from public.inventory inv
      join public.catalog_products cat on cat.id = inv.catalog_product_id
      where inv.is_active = true
        and inv.image_url is not null
        and inv.image_url <> ''
    `;
    const params: (string | number)[] = [];
    if (args.limit != null) {
      params.push(args.limit);
      sql += ` limit $${params.length}`;
    }
    const res = await client.query<Row>(sql, params);
    console.log(`[promote] ${res.rows.length} candidate inventory row(s) with images.`);

    // Count per classification
    const counts: Record<Classification, number> = {
      placeholder: 0,
      wikimedia: 0,
      brand_cdn: 0,
      supabase: 0,
      other: 0,
    };
    for (const r of res.rows) {
      const c = classifyUrl(r.image_url, r.brand);
      counts[c]++;
    }
    console.log("\nurl classification:");
    for (const k of Object.keys(counts) as Classification[]) {
      console.log(`  ${k.padEnd(12)} ${String(counts[k]).padStart(5)}`);
    }

    if (args.analyzeOnly) {
      return;
    }

    // Build best-per-catalog-product map. For each catalog_product_id, keep
    // the single highest-priority inventory row as the promotion source.
    type Pick = { row: Row; cls: Classification };
    const best = new Map<string, Pick>();
    for (const r of res.rows) {
      const cls = classifyUrl(r.image_url, r.brand);
      if (cls === "placeholder") continue;
      if (cls === "wikimedia" && !args.includeWikimedia) continue;
      const existing = best.get(r.catalog_product_id);
      if (!existing || PRIORITY[cls] > PRIORITY[existing.cls]) {
        best.set(r.catalog_product_id, { row: r, cls });
      }
    }

    // Filter out catalog rows that already have an image (idempotency).
    const toPromote: Pick[] = [];
    let already_had_image = 0;
    for (const pick of best.values()) {
      if (pick.row.catalog_image_url) {
        already_had_image++;
        continue;
      }
      toPromote.push(pick);
    }

    const byClass: Record<Classification, number> = {
      placeholder: 0,
      wikimedia: 0,
      brand_cdn: 0,
      supabase: 0,
      other: 0,
    };
    for (const p of toPromote) byClass[p.cls]++;
    console.log("\nafter dedup by catalog_product_id, classification of each would-promote image:");
    for (const k of Object.keys(byClass) as Classification[]) {
      if (byClass[k] > 0) console.log(`  ${k.padEnd(12)} ${String(byClass[k]).padStart(5)}`);
    }
    console.log(`\nwould promote: ${toPromote.length}`);
    console.log(`skipped (catalog already had image): ${already_had_image}`);

    if (args.verbose) {
      console.log("\nsample of would-promote (first 10):");
      for (const p of toPromote.slice(0, 10)) {
        console.log(
          `  [${p.cls.padEnd(10)}] ${p.row.catalog_name.slice(0, 45).padEnd(45)}  ${p.row.image_url.slice(0, 80)}`,
        );
      }
    }

    if (!args.write) {
      console.log("\n[promote] DRY RUN — re-run with --write to commit.");
      return;
    }

    // Commit — batch UPDATE using unnest CTE. Only sets image_url where
    // the catalog row's image_url IS NULL (idempotent guard).
    console.log(`\n[promote] writing ${toPromote.length} image(s)…`);
    const catIds = toPromote.map((p) => p.row.catalog_product_id);
    const urls = toPromote.map((p) => p.row.image_url);
    const sources = toPromote.map((p) => p.row.image_source ?? "pos");
    const contribStores = toPromote.map((p) => p.row.store_id);
    const scores = toPromote.map((p) => QUALITY_SCORE[p.cls]);

    const upd = await client.query(
      `update public.catalog_products as cat
         set image_url                 = data.url,
             image_source              = data.src,
             image_contributor_store_id = data.store_id::uuid,
             image_quality_score       = data.score::numeric
        from (
          select
            unnest($1::uuid[]) as cat_id,
            unnest($2::text[]) as url,
            unnest($3::text[]) as src,
            unnest($4::uuid[]) as store_id,
            unnest($5::numeric[]) as score
        ) as data
        where cat.id = data.cat_id
          and cat.image_url is null`,
      [catIds, urls, sources, contribStores, scores],
    );
    console.log(`[promote] updated ${upd.rowCount} catalog row(s).`);

    // Final coverage report
    const after = await client.query<{ total: string; with_image: string; pct: string }>(`
      select
        count(*)::text as total,
        count(image_url)::text as with_image,
        to_char(100.0 * count(image_url) / nullif(count(*), 0), 'FM999.0') as pct
      from public.catalog_products
    `);
    console.log("\ncatalog_products image coverage AFTER promotion:");
    console.table(after.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[promote] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
