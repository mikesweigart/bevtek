/**
 * clean-inventory-images — NULL out bad inventory.image_url values.
 *
 * Why: inventory.image_url is read FIRST in the resolution pattern
 *   effective_url = inventory.image_url ?? catalog_products.image_url
 * so a garbage inventory URL hides the clean catalog image.
 *
 * Two patterns get nulled:
 *   1. Placeholder — relative paths like "/bottle-coming-soon.svg" or
 *      anything containing "placeholder". Not real images.
 *   2. Wikimedia — upload.wikimedia.org URLs. High false-positive rate
 *      from keyword-based Wikipedia enrichment (e.g. wine named "Barkan"
 *      got a shopping mall photo). Stripping them defaults to showing
 *      the catalog image (or a proper placeholder at render time).
 *
 * Brand-CDN and other external URLs are left alone — those were promoted
 * to the catalog already and there's no harm in keeping them on inventory too.
 *
 * IDEMPOTENT: WHERE clause matches bad URLs, so re-running does nothing.
 *
 * USAGE:
 *   pnpm image:clean           # dry run
 *   pnpm image:clean -- --write
 */

import process from "node:process";
import { Client } from "pg";

type Args = { write: boolean; verbose: boolean };

function parseArgs(): Args {
  const args: Args = { write: false, verbose: false };
  for (const a of process.argv.slice(2)) {
    if (a === "--") continue;
    if (a === "--write") args.write = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "clean-inventory-images — NULL out placeholder/wikimedia image_url values\n" +
          "  --write    Commit (otherwise dry run)\n" +
          "  --verbose  Print samples before writing\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

// Patterns that identify bad image URLs. Both run in SQL so the filter
// is cheap even on large tables.
const PLACEHOLDER_SQL = `(
  image_url like '/%' or
  lower(image_url) like '%bottle-coming-soon%' or
  lower(image_url) like '%placeholder%'
)`;

const WIKIMEDIA_SQL = `(
  lower(image_url) like '%upload.wikimedia.org%' or
  lower(image_url) like '%wikipedia.org/%'
)`;

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
    const counts = await client.query<{
      placeholder: string;
      wikimedia: string;
      total_bad: string;
    }>(`
      select
        count(*) filter (where ${PLACEHOLDER_SQL})::text as placeholder,
        count(*) filter (where ${WIKIMEDIA_SQL})::text as wikimedia,
        count(*) filter (where ${PLACEHOLDER_SQL} or ${WIKIMEDIA_SQL})::text as total_bad
      from public.inventory
      where image_url is not null and is_active = true
    `);
    console.log("\nwill null out:");
    console.table(counts.rows);

    if (args.verbose) {
      const samples = await client.query<{ name: string; image_url: string }>(`
        select name, image_url
        from public.inventory
        where image_url is not null and is_active = true
          and (${PLACEHOLDER_SQL} or ${WIKIMEDIA_SQL})
        order by random()
        limit 10
      `);
      console.log("\nsample (10 random):");
      for (const r of samples.rows) {
        console.log(`  ${r.name.slice(0, 50).padEnd(50)} → ${r.image_url.slice(0, 80)}`);
      }
    }

    if (!args.write) {
      console.log("\n[clean] DRY RUN — re-run with --write to commit.");
      return;
    }

    const upd = await client.query(`
      update public.inventory
         set image_url = null,
             image_source = null
       where image_url is not null
         and is_active = true
         and (${PLACEHOLDER_SQL} or ${WIKIMEDIA_SQL})
    `);
    console.log(`\n[clean] nulled ${upd.rowCount} inventory row(s).`);

    const after = await client.query<{ total: string; with_image: string; pct: string }>(`
      select
        count(*)::text as total,
        count(image_url)::text as with_image,
        to_char(100.0 * count(image_url) / nullif(count(*), 0), 'FM999.0') as pct
      from public.inventory
      where is_active = true
    `);
    console.log("\ninventory.image_url coverage AFTER cleanup:");
    console.table(after.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[clean] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
