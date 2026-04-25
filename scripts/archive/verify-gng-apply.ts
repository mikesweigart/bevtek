/**
 * verify-gng-apply — one-shot sanity check after running apply phase.
 * Confirms the DB state matches the apply-log's claimed numbers and that
 * existing POS-source images weren't clobbered.
 */
import process from "node:process";
import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

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

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    console.log("\n=== catalog_products coverage ===");
    const cov = await client.query(
      `select
         count(*)::int                                                              as total,
         count(*) filter (where image_url is not null)::int                          as with_image,
         count(*) filter (where image_url is null)::int                              as null_image,
         round(100.0 * count(*) filter (where image_url is not null) / count(*), 1) as pct_covered
       from public.catalog_products`,
    );
    console.table(cov.rows);

    console.log("\n=== image_source breakdown ===");
    const src = await client.query(
      `select coalesce(image_source, '(null)') as image_source, count(*)::int as n
         from public.catalog_products
        group by 1
        order by 2 desc`,
    );
    console.table(src.rows);

    console.log("\n=== sample 10 freshly-scraped rows ===");
    const samp = await client.query(
      `select canonical_name, size_ml, image_quality_score, substring(image_url from 1 for 80) as image_url
         from public.catalog_products
        where image_source = 'grapes_and_grains'
        order by enriched_at desc
        limit 10`,
    );
    console.table(samp.rows);

    console.log("\n=== POS images intact? (should match 218 from before) ===");
    const pos = await client.query(
      `select count(*)::int as pos_images from public.catalog_products where image_source = 'pos'`,
    );
    console.table(pos.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
