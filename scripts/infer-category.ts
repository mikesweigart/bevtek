/**
 * infer-category — backfill `inventory.category` for rows where the POS
 * import left it NULL or empty.
 *
 * WHY THIS EXISTS:
 *   Gabby's `/api/gabby/recommend` filters on `category` (ilike match).
 *   The enrichment pipeline (`enrich-inventory-metadata.ts`) SKIPS rows
 *   with NULL category because it only processes the known taxonomy
 *   (wine/beer/spirits/mixer/garnish). Result: a store with 6,291 active
 *   rows but only 2,859 categorized ships with 55% of its catalog
 *   effectively invisible to the guided flows.
 *
 *   This script fixes that. Two passes:
 *     1. DETERMINISTIC — regex match on the name. Covers the obvious
 *        "BOURBON 750ml" / "CHARDONNAY 750ml" / "IPA 6PK" cases.
 *     2. HAIKU FALLBACK — whatever the regex couldn't classify gets
 *        batched to Haiku. Usually 10-15% of the NULL rows.
 *
 *   Both passes write only when the row's category is currently NULL or
 *   empty. COALESCE means we never stomp a manually-set value.
 *
 * USAGE:
 *   # Read-only analysis — counts NULL rows and what the deterministic
 *   # rules would do, plus Haiku cost estimate for the remainder.
 *   SUPABASE_DB_URL=... pnpm infer:category:analyze
 *
 *   # Dry-run (default) — shows everything, writes nothing.
 *   SUPABASE_DB_URL=... ANTHROPIC_API_KEY=... pnpm infer:category
 *
 *   # Deterministic-only (no Haiku spend) — quick first pass.
 *   SUPABASE_DB_URL=... pnpm infer:category -- --deterministic-only --write
 *
 *   # Full run with writes.
 *   SUPABASE_DB_URL=... ANTHROPIC_API_KEY=... pnpm infer:category -- --write
 *
 * SAFETY:
 *   - Dry-run by default. --write is opt-in.
 *   - COALESCE on UPDATE — existing category values never stomped.
 *   - Category values are restricted to the known taxonomy. If Haiku
 *     returns something weird ("malt beverage"), we skip the row rather
 *     than writing garbage.
 *   - Resumable: re-running only picks up rows where category is still NULL.
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { Client } from "pg";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

type Args = {
  write: boolean;
  analyzeOnly: boolean;
  deterministicOnly: boolean;
  storeId: string | null;
  limit: number | null;
  batchSize: number;
  model: string;
  output: string;
  verbose: boolean;
};

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const args: Args = {
    write: false,
    analyzeOnly: false,
    deterministicOnly: false,
    storeId: null,
    limit: null,
    batchSize: 20,
    model: "claude-haiku-4-5",
    output: `scripts/eval-results/infer-category-${new Date().toISOString().slice(0, 10)}.json`,
    verbose: false,
  };
  for (const a of raw) {
    if (a === "--write") args.write = true;
    else if (a === "--analyze-only" || a === "--analyze") args.analyzeOnly = true;
    else if (a === "--deterministic-only") args.deterministicOnly = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a.startsWith("--store-id=")) args.storeId = a.split("=")[1];
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a.startsWith("--batch-size=")) args.batchSize = Math.max(1, Number(a.split("=")[1]) || 20);
    else if (a.startsWith("--model=")) args.model = a.split("=")[1];
    else if (a.startsWith("--output=")) args.output = a.split("=")[1];
    else if (a === "--help" || a === "-h") {
      console.log(
        "infer-category — backfill NULL category on inventory rows\n" +
          "  --write               Commit to DB (default: dry-run)\n" +
          "  --analyze-only        Read-only stats, no Haiku, no API key\n" +
          "  --deterministic-only  Skip Haiku fallback (covers ~85% of rows)\n" +
          "  --store-id=<uuid>     Restrict to one store\n" +
          "  --limit=<n>           Max rows to process\n" +
          "  --batch-size=<n>      Haiku batch size (default 20)\n" +
          "  --verbose             Print every before/after\n",
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
// Taxonomy and deterministic rules
// ---------------------------------------------------------------------------

// The 5 canonical categories Gabby's recommend endpoint understands.
// Anything outside this set should be skipped rather than written.
type Category = "wine" | "beer" | "spirits" | "mixer" | "garnish";
const VALID_CATEGORIES = new Set<Category>([
  "wine", "beer", "spirits", "mixer", "garnish",
]);

// Each rule: a regex on the name, and the category to assign on match.
// Order matters — earlier rules win. Put most-specific first.
//
// Ordering strategy (learned from dry-run misses):
//   1. Specific BEER styles (stout, porter, IPA, ale) — beats "bourbon barrel stout"
//   2. WINE varietals + wine-specific phrases
//   3. SPIRITS
//   4. MIXER keywords (bitters, mix, syrup)
//   5. GARNISH
//   6. Generic BEER signals (pack size, can, brewing) — LAST, as fallback only.
//      These are too aggressive to run first: they'd catch "SUTTER HOME CHARD 4PK"
//      (wine) and "BLOODY MARY MIX 6PK" (mixer) before the specific keyword hits.
type DeterministicRule = { pattern: RegExp; category: Category };
const DET_RULES: DeterministicRule[] = [
  // ---- BEER specific styles (check before SPIRITS — "bourbon barrel stout" is beer) ----
  { pattern: /\b(ipa|pale ale|lager|pilsner|stout|porter|saison|witbier|hefeweizen|dunkel|kolsch|kölsch|gose|sour|tripel|dubbel|quadrupel|rauchbier|bock|barleywine|schwarzbier)\b/i, category: "beer" },
  { pattern: /\b(ale|wheat ale|brown ale|amber ale|red ale|blonde ale)\b/i, category: "beer" },
  { pattern: /\b(cider|hard cider|seltzer|hard seltzer)\b/i, category: "beer" },

  // ---- WINE ----
  // Note: "chard" is a common POS abbreviation for chardonnay ("SUTTER HOME CHARD 4PK").
  // Note: "cab" is ambiguous (could be Cab franc/Cab sauv but also "cab" in brand names) — skip.
  { pattern: /\b(cabernet|chardonnay|chard|merlot|pinot\s+noir|pinot\s+grigio|pinot\s+gris|sauvignon\s+blanc|riesling|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|chianti|barolo|barbera|nebbiolo|grenache|mourvedre|viognier|gewurztraminer|muscat|moscato|prosecco|champagne|cava|rosé|rose\b)/i, category: "wine" },
  // Dropped standalone "sherry"/"madeira"/"vermouth" — they appear in sherry-cask whiskey
  // ("STRANAHANS SHERRY CASK"). The "port wine" phrase is kept because "port" alone is too loose.
  { pattern: /\b(red blend|white blend|red wine|white wine|rose wine|sparkling wine|dessert wine|port wine)\b/i, category: "wine" },
  { pattern: /\b(napa|sonoma|willamette|bordeaux|burgundy|rioja|tuscan|tuscany|mendoza|rhône|rhone)\b.*\b(2\d{3}|1\d{3})\b/i, category: "wine" }, // region + vintage
  { pattern: /\b(2\d{3}|1\d{3})\b\s*(750ml|1\.5l|375ml|187ml)/i, category: "wine" }, // vintage year near wine sizes
  { pattern: /\b(estate|vineyard|winery|cellars?)\b/i, category: "wine" },

  // ---- SPIRITS ----
  { pattern: /\b(bourbon|whiskey|whisky|scotch|rye|vodka|tequila|mezcal|rum|gin|cognac|brandy|absinthe|cachaca|cachaça|sake|soju|grappa|pisco|armagnac|calvados)\b/i, category: "spirits" },
  { pattern: /\b(liqueur|schnapps|aperitivo|aperitif|amaro|amaretto|sambuca|ouzo|anisette|chartreuse)\b/i, category: "spirits" },
  { pattern: /\b(blanco|reposado|añejo|anejo|cristalino|extra\s+añejo)\b/i, category: "spirits" }, // tequila subtypes
  { pattern: /\b(sherry\s+cask|sherry\s+finish|madeira\s+cask|port\s+cask|port\s+finish)\b/i, category: "spirits" }, // cask-finished whiskies
  { pattern: /\bmoonshine\b/i, category: "spirits" },
  { pattern: /\b(vermouth)\b/i, category: "spirits" }, // fortified aromatized wine, but shelved/used like spirits

  // ---- MIXER ----
  { pattern: /\b(bitters|grenadine|simple syrup|orgeat|margarita mix|bloody mary mix|tonic|club soda|ginger beer|ginger ale)\b/i, category: "mixer" },
  { pattern: /\b(soda|juice|syrup|mix|mixer)\b/i, category: "mixer" },
  { pattern: /\brtd\b|\bready\s*to\s*drink\b/i, category: "mixer" }, // pre-mixed cocktails
  { pattern: /\bcocktail\b(?!\s+bitters?)/i, category: "mixer" },

  // ---- GARNISH ----
  { pattern: /\b(olives?|cherries?|cocktail cherries|maraschino|cocktail onions?|lemon peel|orange peel|rimming salt)\b/i, category: "garnish" },

  // ---- BEER fallback signals (LAST — these catch generic packaging hints only
  // after all specific keyword rules have had a chance to fire) ----
  { pattern: /\b\d+\s*pk\b|\b\d+pk\b/i, category: "beer" }, // 6PK, 12PK, etc.
  { pattern: /\bcan\b|\bcn\b(?:\s|$)/i, category: "beer" },
  { pattern: /\bbrewing\b|\bbrewery\b/i, category: "beer" },
];

function deterministicInfer(name: string): Category | null {
  if (!name) return null;
  for (const rule of DET_RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  store_id: string;
  name: string;
  brand: string | null;
  varietal: string | null;
  subcategory: string | null;
};

// ---------------------------------------------------------------------------
// Haiku fallback
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You classify beverages into exactly one of these categories:
- "wine"     (still/sparkling/fortified wine, including champagne, prosecco, rosé, port, sherry, vermouth)
- "beer"     (beer, ale, lager, stout, porter, IPA, cider, hard seltzer — anything in cans/6-packs by tradition)
- "spirits"  (whiskey, vodka, gin, tequila, rum, cognac, liqueurs, cordials, schnapps, etc.)
- "mixer"    (non-alcoholic mixers, bitters, syrups, pre-mixed cocktails, RTD drinks)
- "garnish"  (olives, cocktail cherries, rimming salt, peel)

If you genuinely cannot tell, return null. Do NOT return anything outside this set.

Respond with pure JSON of the form:
{"results": [{"id": "...", "category": "wine"|"beer"|"spirits"|"mixer"|"garnish"|null}]}`;

function buildUserPrompt(rows: Row[]): string {
  const lines = rows.map((r) =>
    JSON.stringify({
      id: r.id,
      name: r.name,
      brand: r.brand,
      varietal: r.varietal,
      subcategory: r.subcategory,
    }),
  );
  return `Classify each product. Return one result per id.\n\n${lines.join("\n")}`;
}

type HaikuResult = { id: string; category: string | null };

async function callHaiku(
  rows: Row[],
  model: string,
  apiKey: string,
): Promise<{ results: HaikuResult[]; inputTokens: number; outputTokens: number }> {
  const body = {
    model,
    max_tokens: 800,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(rows) }],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  // Haiku usually returns clean JSON, but strip code fences just in case.
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let parsed: { results?: HaikuResult[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Haiku returned unparseable JSON: ${cleaned.slice(0, 200)}`);
  }
  return {
    results: parsed.results ?? [],
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!args.analyzeOnly && !args.deterministicOnly && !apiKey) {
    console.error(
      "ANTHROPIC_API_KEY not set (use --analyze-only or --deterministic-only to skip Haiku).",
    );
    process.exit(1);
  }

  console.log("[infer-category] starting", {
    write: args.write,
    analyzeOnly: args.analyzeOnly,
    deterministicOnly: args.deterministicOnly,
    storeId: args.storeId ?? "(all)",
    limit: args.limit ?? "(unlimited)",
    batchSize: args.batchSize,
    model: args.model,
    output: args.output,
  });

  const outPath = resolve(args.output);
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  if (!args.analyzeOnly) {
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          started_at: new Date().toISOString(),
          args,
          entries: "appended below as NDJSON; final summary at end",
        },
        null,
        2,
      ) + "\n",
    );
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const params: (string | number)[] = [];
    const where: string[] = [
      "is_active = true",
      "name is not null",
      "name != ''",
      "(category is null or category = '')",
    ];
    if (args.storeId) {
      params.push(args.storeId);
      where.push(`store_id = $${params.length}`);
    }
    let sql = `
      select id, store_id::text, name, brand, varietal, subcategory
      from public.inventory
      where ${where.join(" and ")}
      order by id
    `;
    if (args.limit) {
      params.push(args.limit);
      sql += ` limit $${params.length}`;
    }
    const res = await client.query<Row>(sql, params);
    const rows = res.rows;
    console.log(`[infer-category] ${rows.length} row(s) have NULL/empty category.`);

    // Pass 1: deterministic
    const detMatches = new Map<string, Category>();
    const detUnresolved: Row[] = [];
    const detCounts = new Map<Category, number>();
    for (const r of rows) {
      const cat = deterministicInfer(r.name);
      if (cat) {
        detMatches.set(r.id, cat);
        detCounts.set(cat, (detCounts.get(cat) ?? 0) + 1);
      } else {
        detUnresolved.push(r);
      }
    }
    console.log(
      `[infer-category] deterministic pass resolved ${detMatches.size}/${rows.length} rows`,
    );
    for (const [cat, n] of detCounts) {
      console.log(`    ${cat.padEnd(10)} ${n}`);
    }
    console.log(`    unresolved  ${detUnresolved.length} (Haiku candidates)`);

    if (args.analyzeOnly) {
      // Cost estimate for the Haiku fallback
      const batches = Math.ceil(detUnresolved.length / args.batchSize);
      const estimatedCost = (batches * 0.0005).toFixed(3);
      console.log(
        `\n[infer-category] estimated Haiku cost for unresolved: ~$${estimatedCost} (${batches} batches of ${args.batchSize})`,
      );
      console.log(
        `[infer-category] analyze-only — no writes, no Haiku calls.`,
      );
      return;
    }

    // Write deterministic matches
    let writtenDet = 0;
    for (const [id, cat] of detMatches) {
      if (args.write) {
        await client.query(
          `update public.inventory
              set category = coalesce(nullif(category, ''), $2)
            where id = $1`,
          [id, cat],
        );
        writtenDet++;
      }
      appendFileSync(
        outPath,
        JSON.stringify({
          id,
          name: rows.find((r) => r.id === id)?.name ?? "",
          source: "deterministic",
          category: cat,
          written: args.write,
        }) + "\n",
      );
    }
    console.log(
      `[infer-category] deterministic writes: ${writtenDet} (dry-run=${!args.write})`,
    );

    // Pass 2: Haiku
    let writtenHaiku = 0;
    let haikuErrors = 0;
    let totalIn = 0;
    let totalOut = 0;
    if (args.deterministicOnly) {
      console.log("[infer-category] --deterministic-only — skipping Haiku pass.");
    } else if (detUnresolved.length === 0) {
      console.log("[infer-category] nothing left for Haiku.");
    } else {
      console.log(
        `[infer-category] Haiku pass: ${detUnresolved.length} row(s) in ${Math.ceil(detUnresolved.length / args.batchSize)} batches`,
      );
      for (let i = 0; i < detUnresolved.length; i += args.batchSize) {
        const batch = detUnresolved.slice(i, i + args.batchSize);
        try {
          const { results, inputTokens, outputTokens } = await callHaiku(
            batch,
            args.model,
            apiKey!,
          );
          totalIn += inputTokens;
          totalOut += outputTokens;
          for (const r of results) {
            const cat = r.category as Category | null;
            if (!cat || !VALID_CATEGORIES.has(cat)) {
              appendFileSync(
                outPath,
                JSON.stringify({
                  id: r.id,
                  source: "haiku",
                  category: null,
                  skipped: true,
                  reason: "category-not-in-taxonomy",
                  raw: r.category,
                }) + "\n",
              );
              continue;
            }
            if (args.write) {
              await client.query(
                `update public.inventory
                    set category = coalesce(nullif(category, ''), $2)
                  where id = $1`,
                [r.id, cat],
              );
              writtenHaiku++;
            }
            appendFileSync(
              outPath,
              JSON.stringify({
                id: r.id,
                source: "haiku",
                category: cat,
                written: args.write,
              }) + "\n",
            );
            if (args.verbose) {
              const row = batch.find((b) => b.id === r.id);
              console.log(
                `  [haiku] ${(row?.name ?? "").slice(0, 60).padEnd(60)} -> ${cat}`,
              );
            }
          }
        } catch (e) {
          haikuErrors++;
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[infer-category] batch ${i} error: ${msg}`);
          appendFileSync(
            outPath,
            JSON.stringify({
              source: "haiku",
              batch_start: i,
              error: msg,
            }) + "\n",
          );
        }
        if (i > 0 && i % (args.batchSize * 10) === 0) {
          console.log(
            `[infer-category] progress: ${Math.min(i, detUnresolved.length)}/${detUnresolved.length} haiku-processed, ${writtenHaiku} haiku-written, ${haikuErrors} errors, tokens: ${totalIn} in / ${totalOut} out`,
          );
        }
      }
    }

    const estimatedCost = (totalIn * 1e-6 * 1 + totalOut * 1e-6 * 5).toFixed(4);
    const summary = {
      finished_at: new Date().toISOString(),
      total_rows: rows.length,
      deterministic_resolved: detMatches.size,
      haiku_candidates: detUnresolved.length,
      haiku_written: writtenHaiku,
      haiku_errors: haikuErrors,
      deterministic_written: writtenDet,
      input_tokens: totalIn,
      output_tokens: totalOut,
      estimated_cost_usd: Number(estimatedCost),
      dry_run: !args.write,
    };
    appendFileSync(outPath, JSON.stringify({ summary }) + "\n");
    console.log("\n[infer-category] done", summary);
    if (!args.write) {
      console.log(
        "\n[infer-category] DRY RUN — no writes. Re-run with --write to commit.",
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[infer-category] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
