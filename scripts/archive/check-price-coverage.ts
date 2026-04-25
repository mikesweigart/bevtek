// Read-only diagnostic: how many Chamblee inventory rows have prices vs.
// null, bucketed by stock_qty and category. This tells us whether the
// XLSX import will close the gap or whether we still have items Gabby
// can legitimately recommend that have no price.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const STORE_ID = "c7dd888e-94c3-430f-8e62-97603122b392";
const ENV_PATH = resolve(process.cwd(), "apps/web/.env.local");

function loadEnv(name: string): string | null {
  const text = readFileSync(ENV_PATH, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) return null;
  return line.slice(`${name}=`.length).trim().replace(/^['"]|['"]$/g, "");
}

async function main() {
  const supabaseUrl = loadEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = loadEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("✗ missing env");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Paginate the whole store's inventory.
  const all: Array<{ sku: string; price: number | null; stock_qty: number; category: string | null; name: string }> = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("inventory")
      .select("sku, price, stock_qty, category, name")
      .eq("store_id", STORE_ID)
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("✗", error.message);
      process.exit(1);
    }
    const rows = (data ?? []) as typeof all;
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  const inStock = all.filter((r) => (r.stock_qty ?? 0) > 0);
  const inStockNull = inStock.filter((r) => r.price == null);
  const inStockPriced = inStock.filter((r) => r.price != null);

  console.log(`Total inventory:        ${all.length}`);
  console.log(`  with price:           ${all.filter((r) => r.price != null).length}`);
  console.log(`  null price:           ${all.filter((r) => r.price == null).length}`);
  console.log();
  console.log(`In stock (qty > 0):     ${inStock.length}`);
  console.log(`  with price:           ${inStockPriced.length}`);
  console.log(`  null price:           ${inStockNull.length}`);
  console.log();

  // Category breakdown for the null-priced in-stock items.
  const byCat = new Map<string, number>();
  for (const r of inStockNull) {
    const k = r.category ?? "(null)";
    byCat.set(k, (byCat.get(k) ?? 0) + 1);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log("Top categories among in-stock null-price items:");
  for (const [cat, n] of cats) {
    console.log(`  ${n.toString().padStart(4)}  ${cat}`);
  }
  console.log();

  console.log("Example null-price in-stock items (first 10):");
  for (const r of inStockNull.slice(0, 10)) {
    const sku = (r.sku ?? "(null)").toString();
    console.log(`  ${sku.padEnd(10)} qty=${r.stock_qty}  ${r.name ?? "(no name)"}`);
  }

  // Cross-check: how many in-stock null-price items have a matching
  // XLSX entry? This tells us whether XLSX will close the gap or if we
  // need another price source for the rest.
  const { readFileSync } = await import("node:fs");
  const XLSX = await import("xlsx");
  const wb = XLSX.read(
    readFileSync(resolve(process.cwd(), "G&G Chamblee Inventory List.xlsx")),
    { type: "buffer" },
  );
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return;
  const xlsxRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const xlsxSkus = new Set(
    xlsxRows
      .map((r) => (r["Product Number"] ?? "").toString().trim())
      .filter((s) => s.length > 0),
  );

  const inStockNullInXlsx = inStockNull.filter((r) => xlsxSkus.has(r.sku));
  const inStockNullNotInXlsx = inStockNull.filter((r) => !xlsxSkus.has(r.sku));
  console.log();
  console.log("─── In-stock null-price vs. XLSX ───");
  console.log(`  in XLSX (price available):    ${inStockNullInXlsx.length}`);
  console.log(`  NOT in XLSX (no price src):   ${inStockNullNotInXlsx.length}`);
  console.log();
  console.log("Sample NOT-in-XLSX in-stock null items:");
  for (const r of inStockNullNotInXlsx.slice(0, 10)) {
    console.log(`  ${(r.sku ?? "").padEnd(10)} qty=${r.stock_qty}  ${r.name ?? ""}`);
  }
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
