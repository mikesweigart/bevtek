/**
 * image-coverage — how much image data do we already have?
 *
 * Reports, across BOTH inventory and catalog_products:
 *   - Rows with image_url filled vs null
 *   - image_source breakdown (pos / upc_api / staff_upload / ...)
 *   - A handful of example URLs so we can eyeball format (CDN? Storage? external?)
 *   - How many catalog rows are orphaned (no image) per category — tells us
 *     which categories to prioritize for photo capture
 *
 * Read-only. Safe any time.
 *
 * USAGE: SUPABASE_DB_URL=... pnpm image:coverage
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
    // Inventory-level coverage
    const invCov = await client.query(`
      select
        count(*)::text as total,
        count(image_url)::text as with_image,
        to_char(100.0 * count(image_url) / nullif(count(*), 0), 'FM999.0') as pct
      from public.inventory
      where is_active = true
    `);
    console.log("\ninventory.image_url coverage:");
    console.table(invCov.rows);

    // Catalog-level coverage
    const catCov = await client.query(`
      select
        count(*)::text as total,
        count(image_url)::text as with_image,
        to_char(100.0 * count(image_url) / nullif(count(*), 0), 'FM999.0') as pct
      from public.catalog_products
    `);
    console.log("\ncatalog_products.image_url coverage:");
    console.table(catCov.rows);

    // image_source breakdown (inventory)
    const invSrc = await client.query(`
      select coalesce(image_source, '(null)') as source, count(*)::text as n
      from public.inventory
      where is_active = true and image_url is not null
      group by 1
      order by 2 desc
    `);
    console.log("\ninventory.image_source breakdown (where image_url is set):");
    if (invSrc.rows.length === 0) {
      console.log("  (no rows have image_url)");
    } else {
      console.table(invSrc.rows);
    }

    // Sample URLs — so we can tell if they're external CDNs, Supabase Storage, placeholders, etc.
    const invSamples = await client.query(`
      select name, image_url
      from public.inventory
      where is_active = true and image_url is not null
      order by random()
      limit 5
    `);
    console.log("\nsample inventory image URLs (5 random):");
    if (invSamples.rows.length === 0) {
      console.log("  (none)");
    } else {
      for (const r of invSamples.rows) {
        console.log(`  ${r.name.slice(0, 50).padEnd(50)} → ${r.image_url}`);
      }
    }

    // Catalog coverage gap per category — what needs a photo?
    const catGap = await client.query(`
      select
        category,
        count(*)::text as total,
        count(image_url)::text as with_image,
        (count(*) - count(image_url))::text as missing,
        to_char(100.0 * count(image_url) / nullif(count(*), 0), 'FM999.0') as pct_with_image
      from public.catalog_products
      group by 1
      order by 2 desc
    `);
    console.log("\ncatalog_products image coverage per category (who needs photos most):");
    console.table(catGap.rows);

    // Brand-level opportunity: big brands with no image are the highest-ROI
    // captures (one photo covers many SKUs in the same line).
    const brandGap = await client.query(`
      select
        brand,
        count(*)::text as total_skus,
        count(image_url)::text as with_image,
        (count(*) - count(image_url))::text as missing
      from public.catalog_products
      where brand is not null
      group by 1
      having count(*) - count(image_url) >= 3
      order by count(*) - count(image_url) desc
      limit 15
    `);
    console.log("\ntop 15 brands by missing-image count (high-ROI capture targets):");
    if (brandGap.rows.length === 0) {
      console.log("  (all brands covered)");
    } else {
      console.table(brandGap.rows);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[image-coverage] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
