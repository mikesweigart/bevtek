/**
 * inventory-stats — quick read-only snapshot of the inventory table.
 *
 * Shows rows per store, rows with UPC, rows by category. Useful for
 * deciding whether low dedup rates in the catalog builder reflect single-
 * store-dominant data or brittle fingerprinting.
 *
 * USAGE: SUPABASE_DB_URL=... pnpm inventory:stats
 */

import process from "node:process";
import { Client } from "pg";

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const perStore = await client.query<{ store_id: string; n: string; with_upc: string }>(`
      select store_id::text, count(*) as n, count(upc) as with_upc
      from public.inventory
      where is_active = true
      group by 1
      order by 2 desc
    `);
    console.log("\nper store (active inventory):");
    console.table(perStore.rows);

    const perCat = await client.query<{ category: string; n: string }>(`
      select coalesce(category, '(null)') as category, count(*) as n
      from public.inventory
      where is_active = true
      group by 1
      order by 2 desc
    `);
    console.log("\nper category:");
    console.table(perCat.rows);

    const upcFill = await client.query<{ total: string; with_upc: string; pct: string }>(`
      select
        count(*)::text as total,
        count(upc)::text as with_upc,
        to_char(100.0 * count(upc) / nullif(count(*), 0), 'FM999.0') as pct
      from public.inventory
      where is_active = true
    `);
    console.log("\nupc coverage:");
    console.table(upcFill.rows);

    const brandFill = await client.query<{ total: string; with_brand: string; pct: string }>(`
      select
        count(*)::text as total,
        count(brand)::text as with_brand,
        to_char(100.0 * count(brand) / nullif(count(*), 0), 'FM999.0') as pct
      from public.inventory
      where is_active = true
    `);
    console.log("\nbrand coverage:");
    console.table(brandFill.rows);

    // Look for plausibly-duplicate SKUs ACROSS stores — same brand + first
    // few words of name, different store_ids. If this returns many rows,
    // fingerprinting is under-collapsing cross-store data.
    const crossStore = await client.query<{
      brand: string | null;
      short_name: string;
      stores: string;
      n: string;
    }>(`
      with slim as (
        select
          brand,
          lower(regexp_replace(
            split_part(name, ' ', 1) || ' ' || split_part(name, ' ', 2),
            '[^a-z0-9 ]', '', 'g'
          )) as short_name,
          store_id
        from public.inventory
        where is_active = true and name is not null
      )
      select brand, short_name,
             count(distinct store_id)::text as stores,
             count(*)::text as n
      from slim
      group by 1, 2
      having count(distinct store_id) > 1
      order by 3 desc, 4 desc
      limit 20
    `);
    console.log("\ntop 20 brand+first-two-words appearing in >1 store (potential cross-store dedup targets):");
    if (crossStore.rows.length === 0) {
      console.log("  (none — data is single-store-dominant)");
    } else {
      console.table(crossStore.rows);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[inventory-stats] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
