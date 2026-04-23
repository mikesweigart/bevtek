/**
 * audit-inventory-columns — read-only report of NULL coverage across every
 * column Gabby's guided flows actually filter on.
 *
 * This is a superset of what `enrich-inventory-metadata --analyze-only`
 * does. The enrichment analyzer only looks at columns Haiku fills. This
 * script also reports the columns Haiku DOESN'T touch but Gabby still
 * queries — brand, varietal, subcategory — so you can see where your
 * POS/CSV import is thin and whether the whiskey wizard's final
 * "pick a brand" step will actually work.
 *
 * SAFE TO RUN WHILE ENRICHMENT IS WRITING. Pure SELECT, no row locks.
 *
 * USAGE:
 *   SUPABASE_DB_URL=... pnpm audit:inventory
 *   SUPABASE_DB_URL=... pnpm audit:inventory -- --store-id=<uuid>
 */

import process from "node:process";
import { Client } from "pg";

type Args = {
  storeId: string | null;
};

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const args: Args = { storeId: null };
  for (const a of raw) {
    if (a.startsWith("--store-id=")) args.storeId = a.split("=")[1];
    else if (a === "--help" || a === "-h") {
      console.log(
        "audit-inventory-columns — read-only coverage report\n" +
          "  --store-id=<uuid>   Restrict to one store (default: all)\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

type CoverageRow = {
  store_id: string;
  category: string;
  total_rows: number;
  null_brand: number;
  null_varietal: number;
  null_subcategory: number;
  null_style: number;
  null_flavor_profile: number;
  null_intended_use: number;
  null_body: number;
  null_sweetness: number;
  null_hop_level: number;
  null_abv: number;
  null_tasting_notes: number;
  null_image_url: number;
};

async function queryCoverage(
  client: Client,
  storeId: string | null,
): Promise<CoverageRow[]> {
  const params: (string | number)[] = [];
  const where: string[] = ["is_active = true"];
  if (storeId) {
    params.push(storeId);
    where.push(`store_id = $${params.length}`);
  }
  const sql = `
    select
      store_id::text,
      coalesce(category, '(null)') as category,
      count(*)::int as total_rows,
      count(*) filter (where brand is null or brand = '')::int as null_brand,
      count(*) filter (where varietal is null or varietal = '')::int as null_varietal,
      count(*) filter (where subcategory is null or subcategory = '')::int as null_subcategory,
      count(*) filter (where style is null or array_length(style, 1) is null)::int as null_style,
      count(*) filter (where flavor_profile is null or array_length(flavor_profile, 1) is null)::int as null_flavor_profile,
      count(*) filter (where intended_use is null or array_length(intended_use, 1) is null)::int as null_intended_use,
      count(*) filter (where body is null)::int as null_body,
      count(*) filter (where sweetness is null)::int as null_sweetness,
      count(*) filter (where hop_level is null)::int as null_hop_level,
      count(*) filter (where abv is null)::int as null_abv,
      count(*) filter (where tasting_notes is null or tasting_notes = '')::int as null_tasting_notes,
      count(*) filter (where image_url is null or image_url = '')::int as null_image_url
    from public.inventory
    where ${where.join(" and ")}
    group by store_id, category
    order by store_id, category
  `;
  const res = await client.query<CoverageRow>(sql, params);
  return res.rows;
}

function pct(n: number, total: number): string {
  if (total === 0) return "  0%";
  return `${String(Math.round((n / total) * 100)).padStart(3)}%`;
}

function printCoverage(rows: CoverageRow[]) {
  if (rows.length === 0) {
    console.log("[audit] no matching inventory rows found.");
    return;
  }
  const byStore = new Map<string, CoverageRow[]>();
  for (const r of rows) {
    const list = byStore.get(r.store_id) ?? [];
    list.push(r);
    byStore.set(r.store_id, list);
  }
  for (const [sid, list] of byStore) {
    const total = list.reduce((s, r) => s + r.total_rows, 0);
    console.log(`\n  store ${sid.slice(0, 8)}…  ${total} active rows`);
    console.log(
      `    ${"category".padEnd(10)} ${"rows".padStart(5)}  ` +
        `brand  varietal  subcat  style  flavor  use  body  sweet  hop   abv  notes  image`,
    );
    for (const r of list) {
      console.log(
        `    ${r.category.padEnd(10)} ${String(r.total_rows).padStart(5)}   ` +
          `${pct(r.null_brand, r.total_rows)}    ` +
          `${pct(r.null_varietal, r.total_rows)}     ` +
          `${pct(r.null_subcategory, r.total_rows)}    ` +
          `${pct(r.null_style, r.total_rows)}    ` +
          `${pct(r.null_flavor_profile, r.total_rows)}   ` +
          `${pct(r.null_intended_use, r.total_rows)}  ` +
          `${pct(r.null_body, r.total_rows)}   ` +
          `${pct(r.null_sweetness, r.total_rows)}   ` +
          `${pct(r.null_hop_level, r.total_rows)}  ` +
          `${pct(r.null_abv, r.total_rows)}   ` +
          `${pct(r.null_tasting_notes, r.total_rows)}  ` +
          `${pct(r.null_image_url, r.total_rows)}`,
      );
    }
  }
  console.log(
    "\n  values are % NULL (higher = worse). rows = active rows in that category.\n" +
      "  brand/varietal/subcategory come from POS/CSV import — enrichment does NOT fill them.\n" +
      "  style/flavor/use/body/sweet/hop/abv are filled by `pnpm enrich:metadata`.\n" +
      "  tasting_notes/image come from a separate enrichment path (tasting-notes provider).\n",
  );
}

async function main() {
  const args = parseArgs();
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }
  console.log("[audit] connecting…");
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const rows = await queryCoverage(client, args.storeId);
    printCoverage(rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[audit] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
