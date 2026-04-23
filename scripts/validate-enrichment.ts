/**
 * validate-enrichment — post-enrichment sanity check.
 *
 * After `pnpm enrich:metadata -- --write` finishes, run this to confirm
 * Haiku did sensible things. Samples rows per category and checks:
 *
 *   1. Coverage: what fraction got style[] / flavor_profile[] / etc. filled?
 *   2. Category integrity: does a bourbon row get style:["bourbon"]? or did
 *      Haiku hallucinate "tequila" for it? Cross-category bleed is the
 *      single biggest recommender-quality regression.
 *   3. Food pairings: for wine rows, did a pairing token land in
 *      intended_use? (e.g. "steak", "salmon") — the wine-pairing branch
 *      of the guided tree relies on this.
 *   4. ABV: what's the abv fill rate? Haiku is conservative by design,
 *      so some NULLs are expected. This just quantifies the gap.
 *
 * SAFE TO RUN ANY TIME. Pure SELECT, no writes.
 *
 * USAGE:
 *   SUPABASE_DB_URL=... pnpm validate:enrichment
 *   SUPABASE_DB_URL=... pnpm validate:enrichment -- --store-id=<uuid>
 *   SUPABASE_DB_URL=... pnpm validate:enrichment -- --sample=100
 */

import process from "node:process";
import { Client } from "pg";

type Args = {
  storeId: string | null;
  sample: number;
  verbose: boolean;
};

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const args: Args = { storeId: null, sample: 50, verbose: false };
  for (const a of raw) {
    if (a.startsWith("--store-id=")) args.storeId = a.split("=")[1];
    else if (a.startsWith("--sample="))
      args.sample = Math.max(10, Math.min(500, Number(a.split("=")[1]) || 50));
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "validate-enrichment — post-enrichment sanity check\n" +
          "  --store-id=<uuid>   Restrict to one store\n" +
          "  --sample=<n>        Rows to sample per category (default 50, max 500)\n" +
          "  --verbose           Print every mis-labeled row, not just counts\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

type SampleRow = {
  id: string;
  store_id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  varietal: string | null;
  style: string[] | null;
  flavor_profile: string[] | null;
  intended_use: string[] | null;
  body: string | null;
  sweetness: string | null;
  hop_level: string | null;
  abv: number | null;
};

// Heuristic category-integrity rules. If a name says "bourbon" we expect
// style[] to include "bourbon". If it says "tequila" we expect "tequila"
// (or a subtype — blanco/reposado/anejo). A miss here is Haiku confabulating.
type Rule = {
  name: string;
  nameMatch: RegExp;
  expectedStyleAnyOf: string[];
};
const STYLE_RULES: Rule[] = [
  // Reject bourbon-barrel-aged beers and bourbon cream liqueurs — the name
  // mentions bourbon but the product isn't bourbon. Use a negative lookahead.
  { name: "bourbon", nameMatch: /\bbourbon\b(?!.*\b(stout|porter|ale|beer|cream|liqueur|barrel aged)\b)/i, expectedStyleAnyOf: ["bourbon"] },
  { name: "rye", nameMatch: /\brye\b/i, expectedStyleAnyOf: ["rye", "rye whiskey"] },
  { name: "scotch", nameMatch: /\bscotch\b/i, expectedStyleAnyOf: ["scotch", "single malt", "blended scotch"] },
  { name: "irish whiskey", nameMatch: /\birish\b/i, expectedStyleAnyOf: ["irish whiskey", "irish"] },
  { name: "tequila", nameMatch: /\btequila\b|\bblanco\b|\breposado\b|\banejo\b|\bañejo\b/i, expectedStyleAnyOf: ["tequila", "blanco", "reposado", "anejo", "añejo"] },
  { name: "mezcal", nameMatch: /\bmezcal\b/i, expectedStyleAnyOf: ["mezcal"] },
  { name: "vodka", nameMatch: /\bvodka\b/i, expectedStyleAnyOf: ["vodka"] },
  { name: "gin", nameMatch: /\bgin\b/i, expectedStyleAnyOf: ["gin", "london dry", "london dry gin", "plymouth", "old tom", "navy strength", "contemporary gin"] },
  // Reject rum cream liqueurs (RumChata et al.) — name says rum but product is a cream liqueur.
  { name: "rum", nameMatch: /\brum\b(?!.*\b(chata|cream|liqueur)\b)/i, expectedStyleAnyOf: ["rum", "dark rum", "spiced rum", "white rum", "aged rum"] },
  { name: "cognac", nameMatch: /\bcognac\b/i, expectedStyleAnyOf: ["cognac", "brandy"] },
  { name: "cabernet", nameMatch: /\bcabernet\b/i, expectedStyleAnyOf: ["cabernet sauvignon", "cabernet", "red blend"] },
  { name: "chardonnay", nameMatch: /\bchardonnay\b/i, expectedStyleAnyOf: ["chardonnay"] },
  { name: "pinot noir", nameMatch: /\bpinot noir\b/i, expectedStyleAnyOf: ["pinot noir"] },
  { name: "ipa", nameMatch: /\bipa\b/i, expectedStyleAnyOf: ["ipa", "hazy ipa", "double ipa", "session ipa", "west coast ipa", "new england ipa", "imperial ipa"] },
];

type Bucket = {
  total: number;
  filled_style: number;
  filled_flavor: number;
  filled_use: number;
  filled_body: number;
  filled_sweetness: number;
  filled_hop: number;
  filled_abv: number;
  pairing_hits: number; // wine only: rows with a food-pairing token in intended_use
};

const PAIRING_TOKENS = new Set([
  "steak", "beef", "lamb", "red meat", "pasta",
  "chicken", "poultry", "turkey",
  "salmon", "fish", "seafood", "shrimp",
  "vegetarian", "vegetable",
  "dinner", "pairing",
]);

type RuleViolation = {
  id: string;
  name: string;
  ruleName: string;
  gotStyle: string[] | null;
};

async function main() {
  const args = parseArgs();
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }
  console.log("[validate] connecting…");
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const categories = ["spirits", "wine", "beer", "mixer"];
    const violations: RuleViolation[] = [];
    for (const cat of categories) {
      const params: (string | number)[] = [cat];
      const where: string[] = ["is_active = true", "category = $1"];
      if (args.storeId) {
        params.push(args.storeId);
        where.push(`store_id = $${params.length}`);
      }
      params.push(args.sample);
      const sql = `
        select id, store_id::text, name, category, subcategory, varietal,
               style, flavor_profile, intended_use, body, sweetness, hop_level, abv
        from public.inventory
        where ${where.join(" and ")}
        order by random()
        limit $${params.length}
      `;
      const res = await client.query<SampleRow>(sql, params);
      const rows = res.rows;
      if (rows.length === 0) {
        console.log(`\n  ${cat}: no rows in sample.`);
        continue;
      }
      const b: Bucket = {
        total: rows.length,
        filled_style: 0,
        filled_flavor: 0,
        filled_use: 0,
        filled_body: 0,
        filled_sweetness: 0,
        filled_hop: 0,
        filled_abv: 0,
        pairing_hits: 0,
      };
      for (const r of rows) {
        if (r.style && r.style.length > 0) b.filled_style++;
        if (r.flavor_profile && r.flavor_profile.length > 0) b.filled_flavor++;
        if (r.intended_use && r.intended_use.length > 0) b.filled_use++;
        if (r.body) b.filled_body++;
        if (r.sweetness) b.filled_sweetness++;
        if (r.hop_level) b.filled_hop++;
        if (r.abv != null) b.filled_abv++;
        if (r.category === "wine" && r.intended_use) {
          if (r.intended_use.some((t) => PAIRING_TOKENS.has(t.toLowerCase()))) {
            b.pairing_hits++;
          }
        }
        // Category-integrity check: name hints at a style, did style[] land?
        for (const rule of STYLE_RULES) {
          if (!rule.nameMatch.test(r.name)) continue;
          const got = (r.style ?? []).map((s) => s.toLowerCase());
          const ok = rule.expectedStyleAnyOf.some((exp) => got.includes(exp));
          if (!ok) {
            violations.push({
              id: r.id,
              name: r.name,
              ruleName: rule.name,
              gotStyle: r.style,
            });
          }
          break; // one rule per row
        }
      }
      const pct = (n: number) => `${String(Math.round((n / b.total) * 100)).padStart(3)}%`;
      console.log(
        `\n  ${cat.padEnd(8)} sampled ${String(b.total).padStart(4)}  ` +
          `style:${pct(b.filled_style)} flavor:${pct(b.filled_flavor)} use:${pct(b.filled_use)}` +
          (cat === "wine" || cat === "beer" ? ` body:${pct(b.filled_body)}` : "") +
          (cat === "wine" ? ` sweet:${pct(b.filled_sweetness)}` : "") +
          (cat === "beer" ? ` hop:${pct(b.filled_hop)}` : "") +
          ` abv:${pct(b.filled_abv)}` +
          (cat === "wine" ? `  pairing-hits:${pct(b.pairing_hits)}` : ""),
      );
    }

    // Category-integrity violations. These are the high-signal findings —
    // if a bourbon didn't get style:["bourbon"], Gabby's whiskey wizard
    // will leak it into non-bourbon results.
    console.log(
      `\n[validate] category-integrity: ${violations.length} row(s) where name hinted at a style but style[] disagreed.`,
    );
    if (violations.length > 0) {
      const byRule = new Map<string, RuleViolation[]>();
      for (const v of violations) {
        const list = byRule.get(v.ruleName) ?? [];
        list.push(v);
        byRule.set(v.ruleName, list);
      }
      for (const [rule, list] of byRule) {
        console.log(`  ${rule}: ${list.length} miss(es)`);
        const show = args.verbose ? list : list.slice(0, 3);
        for (const v of show) {
          console.log(
            `    ${v.name.slice(0, 60).padEnd(60)} got:${JSON.stringify(v.gotStyle)}`,
          );
        }
        if (!args.verbose && list.length > 3) {
          console.log(`    … ${list.length - 3} more (run with --verbose to see all)`);
        }
      }
      console.log(
        "\n  If a rule has many misses, re-run enrichment for that category with a tighter\n" +
          "  prompt hint, or spot-check the source names for unusual formatting.\n",
      );
    } else {
      console.log("  All sampled rows landed on expected style tokens.\n");
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[validate] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
