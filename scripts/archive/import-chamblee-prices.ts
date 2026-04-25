// One-off import: populates inventory.price for the Grapes & Grains
// Chamblee pilot store from the operator-provided XLSX.
//
// Why this exists:
//   Korona's /products API returns null for most alcohol retail prices
//   (pricing lives in a separate price list Korona doesn't expose through
//   the product endpoint). The operator exported the real retail prices
//   to an XLSX. This script lands those prices in inventory.price keyed
//   by sku first, falling back to exact name match when sku is null —
//   because ~5.9K in-stock rows arrived without a sku (manual-import
//   path that bypassed Korona).
//
//   Scope: in-stock only (stock_qty > 0). Per operator instruction,
//   zero-stock rows are ignored — Gabby won't recommend them anyway
//   because /api/retell/tools/search-inventory filters stock_qty > 0.
//
//   Idempotent: safe to re-run. Only writes price.
//
//   Safe vs. Korona sync: apps/web/lib/korona/sync.ts only overwrites
//   price when Korona sends a non-null price, so values set here persist
//   across syncs unless Korona starts returning prices itself.
//
// Usage (from repo root):
//   pnpm tsx scripts/import-chamblee-prices.ts              # dry run
//   pnpm tsx scripts/import-chamblee-prices.ts --write      # apply

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const STORE_ID = "c7dd888e-94c3-430f-8e62-97603122b392"; // Grapes & Grains Chamblee
const XLSX_PATH = resolve(process.cwd(), "G&G Chamblee Inventory List.xlsx");
const ENV_PATH = resolve(process.cwd(), "apps/web/.env.local");

function loadEnv(name: string): string | null {
  const text = readFileSync(ENV_PATH, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) return null;
  return line.slice(`${name}=`.length).trim().replace(/^['"]|['"]$/g, "");
}

function parsePrice(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Canonical form used for the name fallback. Upper-case, collapse
// whitespace, and drop trailing whitespace. XLSX's header has a trailing
// space ("Product Name ") and some values have a leading space — trim
// handles both.
function canon(s: string | null | undefined): string {
  return (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, " ");
}

async function main() {
  const write = process.argv.includes("--write");

  const supabaseUrl = loadEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = loadEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("✗ missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local");
    process.exit(1);
  }

  // ── Load XLSX ────────────────────────────────────────────────────
  console.log(`→ Reading ${XLSX_PATH}`);
  const wb = XLSX.read(readFileSync(XLSX_PATH), { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) {
    console.error("✗ no sheets in xlsx");
    process.exit(1);
  }
  type XlsxRow = Record<string, unknown>;
  const rows = XLSX.utils.sheet_to_json<XlsxRow>(sheet, { defval: null });
  console.log(`  ${rows.length} rows in XLSX`);

  const priceBySku = new Map<string, number>();
  const priceByName = new Map<string, number>();
  const ambiguousNames = new Set<string>();
  let noSku = 0;
  let noPrice = 0;
  for (const r of rows) {
    const sku = (r["Product Number"] ?? "").toString().trim();
    const name = canon(r["Product Name "] as string | null);
    const price = parsePrice(r["Product Retail Price (Date)"]);

    if (price == null || price <= 0) {
      noPrice += 1;
      continue;
    }
    if (sku) priceBySku.set(sku, price);
    else noSku += 1;

    if (name) {
      const existing = priceByName.get(name);
      if (existing != null && Math.abs(existing - price) > 0.005) {
        ambiguousNames.add(name);
      } else {
        priceByName.set(name, price);
      }
    }
  }
  // Purge ambiguous names — we refuse to pick a price when XLSX has two
  // rows with the same name at different prices (would mis-price an item).
  for (const n of ambiguousNames) priceByName.delete(n);

  console.log(`  ${priceBySku.size} prices keyed by sku`);
  console.log(`  ${priceByName.size} prices keyed by canonical name (${ambiguousNames.size} ambiguous names dropped)`);
  console.log(`  ${noSku} XLSX rows with price but no sku`);
  console.log(`  ${noPrice} XLSX rows skipped (no price)`);
  console.log();

  // ── Load in-stock inventory for the store ────────────────────────
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  console.log(`→ Fetching in-stock inventory for store ${STORE_ID}`);
  type InvRow = { id: string; sku: string | null; name: string; price: number | null; stock_qty: number };
  const inv: InvRow[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("inventory")
      .select("id, sku, name, price, stock_qty")
      .eq("store_id", STORE_ID)
      .gt("stock_qty", 0)
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("✗ supabase fetch failed:", error.message);
      process.exit(1);
    }
    const batch = (data ?? []) as InvRow[];
    inv.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  console.log(`  ${inv.length} in-stock rows`);
  console.log();

  // ── Match & build patch set ──────────────────────────────────────
  type Patch = { id: string; sku: string | null; name: string; price: number; prev: number | null; via: "sku" | "name" };
  const toUpdate: Patch[] = [];
  let matchedBySku = 0;
  let matchedByName = 0;
  let unchanged = 0;
  let unmatched = 0;

  for (const row of inv) {
    let price: number | undefined;
    let via: "sku" | "name" | null = null;

    if (row.sku) {
      const p = priceBySku.get(row.sku);
      if (p != null) {
        price = p;
        via = "sku";
      }
    }
    if (price == null) {
      const p = priceByName.get(canon(row.name));
      if (p != null) {
        price = p;
        via = "name";
      }
    }

    if (price == null || via == null) {
      unmatched += 1;
      continue;
    }

    if (via === "sku") matchedBySku += 1;
    else matchedByName += 1;

    if (row.price != null && Math.abs(row.price - price) < 0.005) {
      unchanged += 1;
      continue;
    }
    toUpdate.push({ id: row.id, sku: row.sku, name: row.name, price, prev: row.price, via });
  }

  console.log("─── Match summary (in-stock only) ───");
  console.log(`  matched by sku:    ${matchedBySku}`);
  console.log(`  matched by name:   ${matchedByName}`);
  console.log(`  unmatched:         ${unmatched}`);
  console.log(`  already correct:   ${unchanged}`);
  console.log(`  will update:       ${toUpdate.length}`);
  console.log();

  const byVia = { sku: 0, name: 0 };
  for (const p of toUpdate) byVia[p.via] += 1;
  console.log(`Updates: ${byVia.sku} via sku, ${byVia.name} via name`);
  console.log();

  if (toUpdate.length === 0) {
    console.log("Nothing to write. Done.");
    return;
  }

  console.log("Sample changes:");
  for (const p of toUpdate.slice(0, 8)) {
    const prev = p.prev == null ? "null" : p.prev.toFixed(2);
    console.log(`  [${p.via}]  ${(p.sku ?? "-").padEnd(10)}  ${prev.padStart(6)} → ${p.price.toFixed(2).padStart(6)}   ${p.name}`);
  }
  console.log();

  if (!write) {
    console.log("⚠ Dry run. Re-run with --write to apply.");
    return;
  }

  // ── Apply ────────────────────────────────────────────────────────
  console.log(`→ Writing ${toUpdate.length} updates (concurrency 20)…`);
  let done = 0;
  let failed = 0;
  const CONCURRENCY = 20;
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= toUpdate.length) return;
      const patch = toUpdate[i];
      if (!patch) return;
      // Update by primary key (id) so null-sku rows still get patched.
      const { error } = await supabase
        .from("inventory")
        .update({ price: patch.price })
        .eq("id", patch.id);
      if (error) {
        failed += 1;
        if (failed <= 5) console.error(`  ✗ ${patch.id} (${patch.name}): ${error.message}`);
      } else {
        done += 1;
      }
      if (done > 0 && done % 500 === 0) {
        console.log(`  …${done}/${toUpdate.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log();
  console.log(`✓ Updated: ${done}`);
  if (failed) console.log(`✗ Failed:  ${failed}`);
}

main().catch((e) => {
  console.error("✗ Unexpected error:", e);
  process.exit(1);
});
