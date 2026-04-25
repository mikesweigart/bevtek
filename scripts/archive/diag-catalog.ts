/**
 * diag-catalog — one-shot diagnostic to check whether the scraped
 * grapes-and-grains product names actually exist in catalog_products,
 * and in what canonical_name format.
 *
 * Run from the shell that has SUPABASE_DB_URL set:
 *   pnpm tsx scripts/diag-catalog.ts
 */
import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
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

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    console.log("\n=== catalog_products row counts ===");
    const total = await client.query<{
      total: string;
      with_image: string;
      null_image: string;
    }>(
      `select
         count(*)::text                               as total,
         count(*) filter (where image_url is not null)::text as with_image,
         count(*) filter (where image_url is null)::text     as null_image
       from public.catalog_products`,
    );
    console.table(total.rows);

    console.log("\n=== image_source distribution ===");
    const srcs = await client.query(
      "select coalesce(image_source, '(null)') as image_source, count(*)::text as n from public.catalog_products group by 1 order by 2 desc",
    );
    console.table(srcs.rows);

    console.log("\n=== 10 random canonical_names (to see format) ===");
    const samp = await client.query(
      "select canonical_name, brand, size_ml from public.catalog_products order by random() limit 10",
    );
    console.table(samp.rows);

    console.log("\n=== keyword match check (brands from scrape test) ===");
    const q = await client.query(
      `select canonical_name, brand, size_ml,
              case when image_url is null then 'null' else 'has_image' end as img
         from public.catalog_products
        where lower(canonical_name) like any (array[
              '%glenfiddich%','%casamigos%','%plantation%',
              '%hillrock%','%stoli%','%black box%',
              '%camarena%','%te mata%','%idisma%'])
        order by canonical_name limit 50`,
    );
    console.log(`found ${q.rowCount} row(s):`);
    console.table(q.rows);

    console.log("\n=== scraped NDJSON first 10 names — what we're trying to match ===");
    try {
      const fs = await import("node:fs/promises");
      const path = "scripts/eval-results/grapes-and-grains/scraped.ndjson";
      const raw = await fs.readFile(path, "utf8");
      const rows = raw
        .split("\n")
        .filter(Boolean)
        .slice(0, 10)
        .map((l) => {
          try {
            return JSON.parse(l) as { name?: string; size_ml?: number | null };
          } catch {
            return null;
          }
        })
        .filter((x): x is { name?: string; size_ml?: number | null } => !!x);
      console.table(rows);
    } catch (e) {
      console.log(
        "could not read scraped.ndjson:",
        e instanceof Error ? e.message : e,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
