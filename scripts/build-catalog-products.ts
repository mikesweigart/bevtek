/**
 * build-catalog-products — populates public.catalog_products from inventory.
 *
 * After the master-catalog migration landed, `catalog_products` is empty.
 * This script reads every store's enriched `inventory` rows, dedups them
 * into shared catalog entries (keyed by UPC when available, else a
 * normalized brand+name+size+pack fingerprint), and writes the FK back
 * to `inventory.catalog_product_id`.
 *
 * Why it matters: once the links are in place, a photo uploaded at any
 * store propagates to every BevTek store selling the same SKU via the
 * `inventory.image_url ?? catalog_products.image_url` resolution.
 *
 * Design choices:
 *   - UPC first, fingerprint as fallback. Some POS imports have UPC;
 *     most don't. Fingerprint catches the rest.
 *   - Normalization is permissive but deterministic. "WOODFORD RESERVE
 *     750ML" and "Woodford Reserve 750 ml" fingerprint identically.
 *   - Multiple stores' enriched fields for the same SKU get MERGED by
 *     picking the most recent non-null value (prefer higher
 *     enrichment_version, then newer enriched_at, then just "first
 *     non-null wins" as a final tie-breaker). The catalog row holds
 *     the "best known" enrichment; per-store inventory rows can still
 *     override in their own row.
 *   - Idempotent. Upsert-on-unique-constraint means re-running is safe.
 *     Existing catalog rows get their non-null fields filled in, not
 *     overwritten.
 *
 * Usage:
 *   # Analyze: how many unique catalog products would we create?
 *   pnpm catalog:build --analyze-only
 *
 *   # Dry run on a small slice (no writes):
 *   pnpm catalog:build:dry
 *
 *   # Commit for one store first to spot-check:
 *   pnpm catalog:build -- --store-id=<uuid> --write
 *
 *   # Full run:
 *   pnpm catalog:build -- --write
 *
 * Environment:
 *   SUPABASE_DB_URL   Postgres connection string.
 */

import process from "node:process";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

type Args = {
  write: boolean;
  analyzeOnly: boolean;
  storeId: string | null;
  limit: number | null;
  batchSize: number;
  verbose: boolean;
  output: string;
};

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const args: Args = {
    write: false,
    analyzeOnly: false,
    storeId: null,
    limit: null,
    batchSize: 500,
    verbose: false,
    output: `scripts/eval-results/build-catalog-products-${new Date().toISOString().slice(0, 10)}.json`,
  };
  for (const a of raw) {
    // Bare "--" is the Unix "end of options" separator. pnpm 10 sometimes
    // forwards it as a literal argv when you use `pnpm <script> -- --flag`.
    // Silently skip it so the command line works whether or not pnpm adds one.
    if (a === "--") continue;
    if (a === "--write") args.write = true;
    else if (a === "--analyze-only") args.analyzeOnly = true;
    else if (a.startsWith("--store-id=")) args.storeId = a.split("=")[1];
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a.startsWith("--batch-size="))
      args.batchSize = Math.max(50, Math.min(2000, Number(a.split("=")[1]) || 500));
    else if (a.startsWith("--output=")) args.output = a.split("=")[1];
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "build-catalog-products — dedup inventory into shared catalog_products\n" +
          "  --write              Commit catalog_products inserts + inventory FK updates\n" +
          "  --analyze-only       Count distinct products, write nothing\n" +
          "  --store-id=<uuid>    Restrict to one store (useful for spot checks)\n" +
          "  --limit=<n>          Process at most N inventory rows (testing)\n" +
          "  --batch-size=<n>     Rows per transaction (default 500)\n" +
          "  --output=<path>      Audit NDJSON path (default scripts/eval-results/)\n" +
          "  --verbose            Print every dedup decision\n",
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

type InventoryRow = {
  id: string;
  store_id: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  varietal: string | null;
  size_ml: number | null;
  upc: string | null;
  image_url: string | null;
  tasting_notes: string | null;
  style: string[] | null;
  flavor_profile: string[] | null;
  intended_use: string[] | null;
  body: string | null;
  sweetness: string | null;
  hop_level: string | null;
  abv: number | null;
  enrichment_version: number | null;
  enriched_at: string | null;
  catalog_product_id: string | null;
};

type ParsedRow = InventoryRow & {
  parsed_size_ml: number | null;
  pack_count: number;
  core_name: string;
  fingerprint: string;
};

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/**
 * Permissive string normalizer used throughout fingerprinting.
 * Lowercases, strips *DNR*, removes all punctuation, collapses whitespace.
 */
function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\*dnr\*/gi, "")
    .replace(/[^\w\s]/g, " ") // punctuation → space (better than delete for name boundaries)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a container size out of a product name and return milliliters.
 * Handles the three formats POS systems actually use:
 *   "750ml" / "750 ml" / "750ML"   → 750
 *   "1.75L" / "1.75 L" / "1L"       → 1750 / 1000
 *   "12oz" / "16 oz" / "25OZ"       → rounded common values (beer/wine standards)
 *
 * Returns null if nothing matched; caller can fall back to inventory.size_ml.
 */
function parseSizeMlFromName(name: string): number | null {
  const s = name.toLowerCase();

  // Liters: "1.75l", "1.5 l", "1 l"
  const literMatch = s.match(/\b(\d+(?:\.\d+)?)\s*l\b/);
  if (literMatch) {
    const liters = parseFloat(literMatch[1]);
    if (liters > 0 && liters <= 20) return Math.round(liters * 1000);
  }

  // Milliliters: "750ml", "187 ml", "100 ML"
  const mlMatch = s.match(/\b(\d+)\s*ml\b/);
  if (mlMatch) {
    const ml = parseInt(mlMatch[1], 10);
    if (ml > 0 && ml <= 20000) return ml;
  }

  // Ounces: normalize to nearest common beverage volume. Beer cans/bottles
  // use a handful of standard sizes; rounding to those keeps fingerprints
  // stable across "12oz" vs "12 oz" vs "12OZ".
  const ozMatch = s.match(/\b(\d+(?:\.\d+)?)\s*oz\b/);
  if (ozMatch) {
    const oz = parseFloat(ozMatch[1]);
    if (oz > 0 && oz <= 100) {
      // Snap to common sizes (ml), else raw conversion
      const ml = oz * 29.5735;
      if (Math.abs(ml - 355) < 10) return 355; // 12oz
      if (Math.abs(ml - 473) < 15) return 473; // 16oz
      if (Math.abs(ml - 651) < 15) return 651; // 22oz
      if (Math.abs(ml - 750) < 20) return 750; // 25oz rounded to wine standard
      if (Math.abs(ml - 237) < 10) return 237; // 8oz
      if (Math.abs(ml - 946) < 20) return 946; // 32oz
      return Math.round(ml);
    }
  }

  return null;
}

/**
 * Parse pack count from name. "6PK" / "12 PK" / "4PACK" → 6 / 12 / 4.
 * Default 1 (single bottle/can) if nothing matched.
 */
function parsePackCount(name: string): number {
  const m = name.toLowerCase().match(/\b(\d+)\s*(?:pk|pack)\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 100) return n;
  }
  return 1;
}

/**
 * Strip size/pack/*DNR* tokens from the name, leaving the "core" product
 * identity. Used for canonical_name (what we display) and as input to the
 * fingerprint (what we dedup on).
 */
function extractCoreName(name: string): string {
  return name
    .replace(/\*dnr\*/gi, "")
    // Remove size suffixes — all three formats
    .replace(/\b\d+(?:\.\d+)?\s*ml\b/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*l\b/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*oz\b/gi, "")
    // Remove pack suffixes
    .replace(/\b\d+\s*(?:pk|pack)\b/gi, "")
    // Remove "cn" / "can" / "bottle" container hints
    .replace(/\b(?:cn|can|btl|bottle|cans|bottles)\b/gi, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute a deterministic fingerprint. Format:
 *   "<normalized_brand>|<normalized_core_name>|<size_ml or 'nosize'>|<pack_count>"
 *
 * Example: "woodford reserve|bourbon|750|1"
 * Example: "terrapin|depth perception|355|6"
 * Example: "|new amsterdam|750|1"   (when brand is missing)
 *
 * Kept as readable text (not a hash) so we can debug collisions by eye.
 */
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
// Merge logic for duplicate inventory rows (same SKU, multiple stores)
// ---------------------------------------------------------------------------

/**
 * Pick the "best" value across multiple candidate rows. Best = non-null,
 * highest enrichment_version wins, then most recent enriched_at, then
 * first one seen. Used to merge enriched metadata when multiple stores
 * have the same SKU.
 */
function pickBest<T>(
  rows: ParsedRow[],
  getter: (r: ParsedRow) => T | null | undefined,
): T | null {
  const candidates = rows
    .map((r) => ({
      value: getter(r),
      version: r.enrichment_version ?? 0,
      at: r.enriched_at ? new Date(r.enriched_at).getTime() : 0,
    }))
    .filter((c) => c.value != null && !(Array.isArray(c.value) && c.value.length === 0));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.version - a.version || b.at - a.at);
  return candidates[0].value as T;
}

type CatalogRowInsert = {
  upc: string | null;
  fingerprint: string;
  canonical_name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  varietal: string | null;
  size_ml: number | null;
  pack_count: number;
  tasting_notes: string | null;
  style: string[] | null;
  flavor_profile: string[] | null;
  intended_use: string[] | null;
  body: string | null;
  sweetness: string | null;
  hop_level: string | null;
  abv: number | null;
  enrichment_version: number;
  enriched_at: string | null;
};

/**
 * Merge a group of ParsedRow (same UPC or fingerprint) into ONE catalog
 * insert payload. Categorical fields (category, subcategory, varietal)
 * take the first non-null. Enrichment fields use pickBest().
 */
function mergeGroup(group: ParsedRow[]): CatalogRowInsert {
  const first = group[0];
  return {
    upc: pickBest(group, (r) => r.upc),
    fingerprint: first.fingerprint,
    canonical_name: pickBest(group, (r) => extractCoreName(r.name)) ?? first.core_name,
    brand: pickBest(group, (r) => r.brand),
    category: first.category,
    subcategory: pickBest(group, (r) => r.subcategory),
    varietal: pickBest(group, (r) => r.varietal),
    size_ml: first.parsed_size_ml ?? pickBest(group, (r) => r.size_ml),
    pack_count: first.pack_count,
    tasting_notes: pickBest(group, (r) => r.tasting_notes),
    style: pickBest(group, (r) => r.style),
    flavor_profile: pickBest(group, (r) => r.flavor_profile),
    intended_use: pickBest(group, (r) => r.intended_use),
    body: pickBest(group, (r) => r.body),
    sweetness: pickBest(group, (r) => r.sweetness),
    hop_level: pickBest(group, (r) => r.hop_level),
    abv: pickBest(group, (r) => r.abv),
    enrichment_version: Math.max(...group.map((r) => r.enrichment_version ?? 0)),
    enriched_at:
      pickBest(group, (r) => r.enriched_at) ?? null,
  };
}

// ---------------------------------------------------------------------------
// DB I/O
// ---------------------------------------------------------------------------

async function fetchInventory(
  client: Client,
  storeId: string | null,
  limit: number | null,
): Promise<InventoryRow[]> {
  const where: string[] = [
    "is_active = true",
    "name is not null",
    "name != ''",
    "category in ('wine','beer','spirits','mixer','garnish')",
  ];
  const params: (string | number)[] = [];
  if (storeId) {
    params.push(storeId);
    where.push(`store_id = $${params.length}`);
  }
  let sql = `
    select
      id, store_id::text, name, brand, category, subcategory, varietal,
      size_ml, upc, image_url, tasting_notes,
      style, flavor_profile, intended_use,
      body, sweetness, hop_level, abv,
      enrichment_version, enriched_at,
      catalog_product_id
    from public.inventory
    where ${where.join(" and ")}
    order by created_at asc nulls last, id asc
  `;
  if (limit != null) {
    params.push(limit);
    sql += ` limit $${params.length}`;
  }
  const res = await client.query<InventoryRow>(sql, params);
  return res.rows;
}

/**
 * Upsert a catalog row by UPC (preferred) or fingerprint (fallback).
 * Returns the row's id regardless of whether it was created or updated.
 *
 * Update policy: existing non-null fields STAY. Only fill in NULLs. This
 * protects any hand-curation that landed on the catalog row after the
 * first build.
 */
async function upsertCatalogRow(
  client: Client,
  row: CatalogRowInsert,
): Promise<string> {
  // The conflict target depends on whether we have a UPC. Two separate
  // unique indexes: (upc) where upc is not null, and (fingerprint).
  const conflictCol = row.upc ? "upc" : "fingerprint";
  const sql = `
    insert into public.catalog_products (
      upc, fingerprint, canonical_name, brand, category, subcategory,
      varietal, size_ml, pack_count,
      tasting_notes, style, flavor_profile, intended_use,
      body, sweetness, hop_level, abv,
      enrichment_version, enriched_at
    ) values (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16, $17,
      $18, $19
    )
    on conflict (${conflictCol})
    do update set
      canonical_name     = coalesce(public.catalog_products.canonical_name, excluded.canonical_name),
      brand              = coalesce(public.catalog_products.brand, excluded.brand),
      subcategory        = coalesce(public.catalog_products.subcategory, excluded.subcategory),
      varietal           = coalesce(public.catalog_products.varietal, excluded.varietal),
      size_ml            = coalesce(public.catalog_products.size_ml, excluded.size_ml),
      tasting_notes      = coalesce(public.catalog_products.tasting_notes, excluded.tasting_notes),
      style              = coalesce(public.catalog_products.style, excluded.style),
      flavor_profile     = coalesce(public.catalog_products.flavor_profile, excluded.flavor_profile),
      intended_use       = coalesce(public.catalog_products.intended_use, excluded.intended_use),
      body               = coalesce(public.catalog_products.body, excluded.body),
      sweetness          = coalesce(public.catalog_products.sweetness, excluded.sweetness),
      hop_level          = coalesce(public.catalog_products.hop_level, excluded.hop_level),
      abv                = coalesce(public.catalog_products.abv, excluded.abv),
      enrichment_version = greatest(public.catalog_products.enrichment_version, excluded.enrichment_version),
      enriched_at        = greatest(public.catalog_products.enriched_at, excluded.enriched_at),
      upc                = coalesce(public.catalog_products.upc, excluded.upc)
    returning id
  `;
  const res = await client.query<{ id: string }>(sql, [
    row.upc,
    row.fingerprint,
    row.canonical_name,
    row.brand,
    row.category,
    row.subcategory,
    row.varietal,
    row.size_ml,
    row.pack_count,
    row.tasting_notes,
    row.style,
    row.flavor_profile,
    row.intended_use,
    row.body,
    row.sweetness,
    row.hop_level,
    row.abv,
    row.enrichment_version,
    row.enriched_at,
  ]);
  return res.rows[0].id;
}

async function linkInventoryBatch(
  client: Client,
  pairs: { inventory_id: string; catalog_product_id: string }[],
): Promise<number> {
  if (pairs.length === 0) return 0;
  // One UPDATE per row via a unnest CTE — much faster than N round trips.
  const ids = pairs.map((p) => p.inventory_id);
  const catIds = pairs.map((p) => p.catalog_product_id);
  const res = await client.query(
    `update public.inventory as inv
       set catalog_product_id = data.cat_id::uuid
      from (
        select unnest($1::uuid[]) as inv_id,
               unnest($2::uuid[]) as cat_id
      ) as data
      where inv.id = data.inv_id
        and (inv.catalog_product_id is null or inv.catalog_product_id <> data.cat_id::uuid)`,
    [ids, catIds],
  );
  return res.rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

type Summary = {
  started_at: string;
  finished_at?: string;
  args: Args;
  inventory_rows: number;
  with_upc: number;
  unique_upcs: number;
  unique_fingerprints: number;
  catalog_rows_written: number;
  inventory_rows_linked: number;
  skipped_rows: number;
  errors: number;
  dry_run: boolean;
};

async function main() {
  const args = parseArgs();

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error(
      "SUPABASE_DB_URL not set. Get it from Supabase → Settings → Database → Connection string (URI).",
    );
    process.exit(1);
  }

  // Prepare audit output
  mkdirSync(path.dirname(args.output), { recursive: true });
  const started_at = new Date().toISOString();
  writeFileSync(
    args.output,
    JSON.stringify({ started_at, args, entries: "appended below as NDJSON; final summary at end" }) + "\n",
  );

  console.log("[build-catalog] starting", {
    write: args.write,
    analyzeOnly: args.analyzeOnly,
    storeId: args.storeId ?? "(all)",
    limit: args.limit ?? "(unlimited)",
    batchSize: args.batchSize,
    output: args.output,
  });

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const summary: Summary = {
    started_at,
    args,
    inventory_rows: 0,
    with_upc: 0,
    unique_upcs: 0,
    unique_fingerprints: 0,
    catalog_rows_written: 0,
    inventory_rows_linked: 0,
    skipped_rows: 0,
    errors: 0,
    dry_run: !args.write,
  };

  try {
    const rows = await fetchInventory(client, args.storeId, args.limit);
    summary.inventory_rows = rows.length;
    console.log(`[build-catalog] ${rows.length} inventory row(s) in scope.`);

    // Parse + compute fingerprint
    const parsed: ParsedRow[] = [];
    for (const r of rows) {
      if (!r.name || r.name.trim().length < 3) {
        summary.skipped_rows++;
        continue;
      }
      const parsed_size_ml = parseSizeMlFromName(r.name) ?? r.size_ml;
      const pack_count = parsePackCount(r.name);
      const core_name = extractCoreName(r.name);
      if (core_name.length < 2) {
        summary.skipped_rows++;
        continue;
      }
      const fingerprint = computeFingerprint(r.brand, core_name, parsed_size_ml, pack_count);
      parsed.push({ ...r, parsed_size_ml, pack_count, core_name, fingerprint });
      if (r.upc) summary.with_upc++;
    }
    console.log(
      `[build-catalog] parsed ${parsed.length} row(s), skipped ${summary.skipped_rows} (blank/short name)`,
    );
    console.log(`[build-catalog] ${summary.with_upc} row(s) have UPC`);

    // Group: UPC-keyed first, fingerprint-keyed for the rest.
    const byUpc = new Map<string, ParsedRow[]>();
    const byFingerprint = new Map<string, ParsedRow[]>();
    for (const r of parsed) {
      if (r.upc) {
        const list = byUpc.get(r.upc) ?? [];
        list.push(r);
        byUpc.set(r.upc, list);
      } else {
        const list = byFingerprint.get(r.fingerprint) ?? [];
        list.push(r);
        byFingerprint.set(r.fingerprint, list);
      }
    }
    summary.unique_upcs = byUpc.size;
    summary.unique_fingerprints = byFingerprint.size;
    const totalUniqueProducts = byUpc.size + byFingerprint.size;

    console.log(
      `[build-catalog] distinct products: ${totalUniqueProducts} ` +
        `(${byUpc.size} by UPC, ${byFingerprint.size} by fingerprint)`,
    );

    // Per-category breakdown
    const byCategory = new Map<string, number>();
    for (const group of [...byUpc.values(), ...byFingerprint.values()]) {
      const c = group[0].category;
      byCategory.set(c, (byCategory.get(c) ?? 0) + 1);
    }
    for (const [cat, n] of [...byCategory.entries()].sort()) {
      console.log(`    ${cat.padEnd(10)} ${String(n).padStart(6)} unique`);
    }

    if (args.analyzeOnly) {
      console.log("\n[build-catalog] analyze-only mode — no inserts, no FK updates.");
      summary.finished_at = new Date().toISOString();
      appendFileSync(args.output, JSON.stringify({ summary }) + "\n");
      return;
    }

    if (!args.write) {
      console.log(
        "\n[build-catalog] DRY RUN — no writes. Re-run with --write to commit.",
      );
      summary.finished_at = new Date().toISOString();
      appendFileSync(args.output, JSON.stringify({ summary }) + "\n");
      return;
    }

    // WRITE PATH: upsert catalog rows, then link inventory.
    const groupsToWrite: { key: string; keyType: "upc" | "fingerprint"; rows: ParsedRow[] }[] = [];
    for (const [upc, rows] of byUpc) {
      groupsToWrite.push({ key: upc, keyType: "upc", rows });
    }
    for (const [fp, rows] of byFingerprint) {
      groupsToWrite.push({ key: fp, keyType: "fingerprint", rows });
    }

    const inventoryLinks: { inventory_id: string; catalog_product_id: string }[] = [];
    let writeCount = 0;
    for (const group of groupsToWrite) {
      try {
        const payload = mergeGroup(group.rows);
        const catalogId = await upsertCatalogRow(client, payload);
        writeCount++;
        for (const r of group.rows) {
          inventoryLinks.push({ inventory_id: r.id, catalog_product_id: catalogId });
        }
        appendFileSync(
          args.output,
          JSON.stringify({
            key_type: group.keyType,
            key: group.key,
            catalog_id: catalogId,
            inventory_ids: group.rows.map((r) => r.id),
            canonical_name: payload.canonical_name,
            category: payload.category,
          }) + "\n",
        );
        if (args.verbose) {
          console.log(
            `  ${group.keyType}=${group.key.slice(0, 40).padEnd(40)} → ${catalogId.slice(0, 8)} (${group.rows.length} inv rows)`,
          );
        }
        if (writeCount % 200 === 0) {
          console.log(
            `[build-catalog] progress: ${writeCount}/${groupsToWrite.length} catalog rows upserted`,
          );
        }
      } catch (e) {
        summary.errors++;
        console.warn(
          `[build-catalog] upsert failed for ${group.keyType}=${group.key}: ${(e as Error).message}`,
        );
      }
    }
    summary.catalog_rows_written = writeCount;

    // Link inventory in batches
    console.log(
      `[build-catalog] linking ${inventoryLinks.length} inventory row(s) to catalog…`,
    );
    let linked = 0;
    for (let i = 0; i < inventoryLinks.length; i += args.batchSize) {
      const batch = inventoryLinks.slice(i, i + args.batchSize);
      try {
        const n = await linkInventoryBatch(client, batch);
        linked += n;
      } catch (e) {
        summary.errors++;
        console.warn(
          `[build-catalog] link batch ${Math.floor(i / args.batchSize)} failed: ${(e as Error).message}`,
        );
      }
    }
    summary.inventory_rows_linked = linked;
    console.log(`[build-catalog] linked ${linked} inventory row(s).`);
  } finally {
    summary.finished_at = new Date().toISOString();
    appendFileSync(args.output, JSON.stringify({ summary }) + "\n");
    await client.end();
  }

  console.log("\n[build-catalog] done", summary);
}

main().catch((e) => {
  console.error("[build-catalog] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
