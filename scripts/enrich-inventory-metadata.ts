/**
 * enrich-inventory-metadata — backfill the guided-tree metadata columns
 * so Gabby's recommendations stop missing well-stocked bottles just
 * because the legacy CSV import didn't know about `style[]`.
 *
 * PROBLEM:
 *   The Gabby recommend endpoint filters on style, flavor_profile,
 *   intended_use, body, sweetness, hop_level. Most historical inventory
 *   rows were imported BEFORE those columns existed, so they're NULL —
 *   which means PostgREST .overlaps() returns zero, which means the
 *   relaxation cascade kicks in and widens the search until it finds
 *   SOMETHING… usually something wrong (e.g. vodka when the shopper
 *   asked for bourbon, which is the bug we just shipped a fix for in
 *   commit 1feca64).
 *
 *   The real cure is not smarter filtering — it's getting those columns
 *   populated. This script does that with one Haiku call per batch of
 *   inventory rows, writing back ONLY to NULL cells so we never stomp
 *   on values an owner curated by hand.
 *
 * WHAT IT FILLS (only when currently NULL):
 *   style[]          canonical style tokens (e.g. {bourbon, rye whiskey})
 *   flavor_profile[] flavor descriptors (e.g. {oaky, caramel, vanilla})
 *   intended_use[]   occasion/use tokens (e.g. {sipping, gift})
 *   body             'light' | 'medium' | 'full' (wine/beer)
 *   sweetness        'dry' | 'off-dry' | 'sweet' (mostly wine)
 *   hop_level        'low' | 'med' | 'high' (beer only)
 *   abv              numeric, only when clearly inferable from the name
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH:
 *   is_local, is_staff_pick  — store-specific; owner's call
 *   tasting_notes, summary   — already covered by tastingNotes enrichment
 *   price, stock_qty         — POS-owned, not inferable from text
 *   name, brand, varietal    — normalizeNames handles these
 *
 * USAGE:
 *   # Dry-run everything (default — no writes):
 *   SUPABASE_DB_URL=... ANTHROPIC_API_KEY=... pnpm enrich:metadata
 *
 *   # Actually write to DB:
 *   SUPABASE_DB_URL=... ANTHROPIC_API_KEY=... pnpm enrich:metadata -- --write
 *
 *   # Scope to one store, small batch (for testing):
 *   SUPABASE_DB_URL=... ANTHROPIC_API_KEY=... pnpm enrich:metadata -- \
 *     --store-id=c7dd888e-94c3-430f-8e62-97603122b392 --limit=20 --write
 *
 * FLAGS:
 *   --write              Commit to DB. Without this, everything is dry-run.
 *   --store-id=<uuid>    Restrict to one store (default: all stores).
 *   --limit=<n>          Max rows to process (default: unlimited).
 *   --batch-size=<n>     Haiku batch size (default: 8).
 *   --model=<name>       Override model (default: claude-haiku-4-5).
 *   --output=<path>      Audit log destination (default:
 *                        scripts/eval-results/enrich-<date>.json).
 *   --verbose            Print every row's inputs/outputs, not just summary.
 *
 * COST NOTE:
 *   Haiku 4.5 at ~$1/M input, ~$5/M output. Per-row budget is roughly:
 *     prompt header + context fields ≈ 400 input tokens shared across
 *     the batch + per-row output ≈ 120 tokens. At batch=8 that's ~65
 *     tokens/row, so ~$0.0005 per row. A 6,000-row catalog is ~$3.
 *
 * SAFETY:
 *   - `--write` is opt-in. Default is dry-run.
 *   - Writes use COALESCE on every column — existing values survive.
 *   - Model is instructed to return null for fields it can't confidently
 *     infer from the name/brand/varietal/notes.
 *   - Progress is flushed to the audit file as we go, so a crash
 *     mid-run still leaves a record of what happened.
 *   - Resumable: re-running skips rows that already have style[]
 *     populated, so you can Ctrl+C and pick back up.
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { Client } from "pg";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Args = {
  write: boolean;
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
    storeId: null,
    limit: null,
    batchSize: 8,
    model: "claude-haiku-4-5",
    output: `scripts/eval-results/enrich-${new Date().toISOString().slice(0, 10)}.json`,
    verbose: false,
  };
  for (const a of raw) {
    if (a === "--write") args.write = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a.startsWith("--store-id=")) args.storeId = a.split("=")[1];
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a.startsWith("--batch-size=")) args.batchSize = Math.max(1, Number(a.split("=")[1]) || 8);
    else if (a.startsWith("--model=")) args.model = a.split("=")[1];
    else if (a.startsWith("--output=")) args.output = a.split("=")[1];
    else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InputRow = {
  id: string;
  store_id: string;
  name: string;
  brand: string | null;
  varietal: string | null;
  category: string | null;
  subcategory: string | null;
  description_short: string | null;
  flavor_notes: string | null;
  tasting_notes: string | null;
  summary_for_customer: string | null;
  abv: number | null;
  // Current values — we only fill the NULL ones.
  style: string[] | null;
  flavor_profile: string[] | null;
  intended_use: string[] | null;
  body: string | null;
  sweetness: string | null;
  hop_level: string | null;
};

type Enrichment = {
  id: string;
  style: string[] | null;
  flavor_profile: string[] | null;
  intended_use: string[] | null;
  body: "light" | "medium" | "full" | null;
  sweetness: "dry" | "off-dry" | "sweet" | null;
  hop_level: "low" | "med" | "high" | null;
  abv: number | null;
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * Controlled vocabularies. The recommend endpoint uses `.overlaps()` on
 * these arrays, so the enrichment output has to land on the SAME tokens
 * the frontend's guided tree uses — otherwise the shopper picks "Fruity"
 * and we return nothing because the row has {apple, berry} but the tree
 * filters for {fruity}. Keep this synced with apps/mobile/lib/gabby/tree.json.
 *
 * "Controlled" is soft — the model may return tokens outside the list if
 * they're clearly apt ("heather" for a Scottish whisky), but we strongly
 * prefer the listed ones by citing them in the prompt as canonical.
 */
const FLAVOR_VOCAB = [
  // Wine
  "fruity", "jammy", "bold", "oaky", "smooth", "vanilla", "earthy", "spicy",
  "peppery", "light", "floral", "easy", "crisp", "citrus", "mineral", "bright",
  "herbal", "savory", "buttery", "rich", "tannic",
  // Whiskey
  "caramel", "chocolate", "sweet", "woody", "toasted", "barrel", "cinnamon",
  "clove", "smoky", "peaty", "smoked", "nutty", "almond", "hazelnut", "honey",
  "heather", "apple", "berry", "pepper",
  // Gin
  "juniper", "classic", "london dry", "botanical", "aged",
  // General
  "dry", "off-dry",
];

const INTENDED_USE_VOCAB = [
  "gift", "cocktail", "mixer", "sipping", "bbq", "dinner", "pairing",
  "party", "share", "celebration", "rare", "luxury", "daily", "everyday",
  "unique", "adventure", "experimental", "neat", "martini", "approachable",
  "smooth", "easy", "balanced", "complex", "bold", "relax",
];

const PAIRING_VOCAB = [
  "red meat", "steak", "lamb", "beef", "chicken", "poultry", "turkey",
  "fish", "seafood", "salmon", "shrimp", "vegetarian", "vegetable", "pasta",
];

function buildPrompt(rows: InputRow[]): string {
  const input = rows.map((r) => {
    const needs: string[] = [];
    if (!r.style || r.style.length === 0) needs.push("style");
    if (!r.flavor_profile || r.flavor_profile.length === 0) needs.push("flavor_profile");
    if (!r.intended_use || r.intended_use.length === 0) needs.push("intended_use");
    if (!r.body && (r.category === "wine" || r.category === "beer")) needs.push("body");
    if (!r.sweetness && r.category === "wine") needs.push("sweetness");
    if (!r.hop_level && r.category === "beer") needs.push("hop_level");
    if (r.abv == null) needs.push("abv");
    return {
      id: r.id,
      name: r.name,
      brand: r.brand,
      varietal: r.varietal,
      category: r.category,
      subcategory: r.subcategory,
      notes: r.tasting_notes ?? r.flavor_notes ?? r.description_short ?? r.summary_for_customer ?? null,
      needs,
    };
  });

  return `You are a beverage catalog enricher. For each product below, infer structured metadata so a retail shopping assistant can match shoppers to bottles via faceted filters.

CANONICAL TOKEN LISTS (prefer these exact spellings — the downstream filters match string-equal):

style tokens (by category):
  wine red:     cabernet sauvignon, merlot, pinot noir, malbec, syrah, shiraz, zinfandel, sangiovese, tempranillo, grenache, petite sirah, cabernet franc, red blend
  wine white:   chardonnay, sauvignon blanc, pinot grigio, riesling, moscato, gewurztraminer, albarino, viognier, chenin blanc, white blend
  wine other:   rose, sparkling, champagne, prosecco, cava, port, sherry, dessert wine
  spirits:      bourbon, rye whiskey, tennessee whiskey, american whiskey, scotch, scotch whisky, single malt, blended scotch, irish whiskey, japanese whisky, canadian whisky, world whisky, vodka, gin, london dry, tequila, reposado, anejo, mezcal, rum, aged rum, spiced rum, brandy, cognac, liqueur, cordial
  beer:         ipa, hazy ipa, double ipa, pale ale, lager, pilsner, stout, porter, wheat, hefeweizen, witbier, sour, gose, fruited, amber, brown ale
  mixer:        tonic, soda, club soda, bitters, juice, syrup, vermouth
  garnish:      olives, cherries, cocktail picks

flavor_profile tokens (use 2–5 per bottle, lowercase):
  ${FLAVOR_VOCAB.join(", ")}

intended_use tokens (use 1–3 per bottle, lowercase):
  ${INTENDED_USE_VOCAB.join(", ")}
  Plus food-pairing hints when obviously apt: ${PAIRING_VOCAB.join(", ")}

body (wine + beer only):
  light | medium | full

sweetness (wine primarily):
  dry | off-dry | sweet

hop_level (beer only):
  low | med | high

abv:
  numeric percent (e.g. 40, 13.5). Typical ranges:
    wine 11–15, beer 4–9 (IPA 6–8), bourbon 40–60,
    vodka/gin 40, tequila 38–42, liqueur 15–30.
  Only fill if you're confident from the name or brand reputation.
  Leave null if unsure — we'd rather have null than a guess.

INPUT (JSON array of products to enrich):
${JSON.stringify(input, null, 2)}

OUTPUT: a JSON array, SAME ORDER, SAME ids, one object per input. For each product:
- Fill the fields listed in its "needs" array.
- For fields NOT in "needs", return null (they already have values).
- If you're not confident about a listed need, return null for THAT field.

Schema:
[
  {
    "id": "<id>",
    "style": ["bourbon", "rye whiskey"] | null,
    "flavor_profile": ["caramel", "vanilla", "oaky"] | null,
    "intended_use": ["sipping", "gift"] | null,
    "body": "full" | null,
    "sweetness": null,
    "hop_level": null,
    "abv": 45 | null
  }
]

RULES:
- NEVER invent a style the product isn't. A Bourbon row must not get "tequila" in its style array.
- NEVER invent tasting notes you can't infer from the name/brand/varietal/notes. "Eagle Rare Bourbon" can honestly carry {caramel, vanilla, oaky}; "Mystery Bottle 750ml" should get null.
- Prefer 2–4 tokens per array field. Fewer if uncertain. Not more than 5.
- Output ONLY the JSON array, no prose, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Anthropic call — raw fetch so we don't need to add @anthropic-ai/sdk
// to the root package.json just for a script.
// ---------------------------------------------------------------------------

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; type?: string };
};

async function callHaiku(
  model: string,
  prompt: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const body = (await res.json()) as AnthropicResponse;
  if (!res.ok) {
    throw new Error(
      `Anthropic ${res.status}: ${body.error?.message ?? JSON.stringify(body).slice(0, 200)}`,
    );
  }
  const block = body.content?.find((b) => b.type === "text");
  if (!block?.text) throw new Error("Anthropic returned no text block.");
  return {
    text: block.text,
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

function parseResponse(text: string, rows: InputRow[]): Enrichment[] {
  // Haiku sometimes wraps JSON in fences or prose despite the prompt.
  // Strip fences; then find the first balanced [...] if JSON.parse fails.
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("[");
    if (start === -1) return [];
    let depth = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "[") depth++;
      else if (cleaned[i] === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return [];
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const byId = new Map<string, Enrichment>();
  for (const raw of parsed as Array<Record<string, unknown>>) {
    const id = typeof raw.id === "string" ? raw.id : null;
    if (!id) continue;
    byId.set(id, {
      id,
      style: cleanArray(raw.style),
      flavor_profile: cleanArray(raw.flavor_profile),
      intended_use: cleanArray(raw.intended_use),
      body: cleanEnum(raw.body, ["light", "medium", "full"]) as Enrichment["body"],
      sweetness: cleanEnum(raw.sweetness, ["dry", "off-dry", "sweet"]) as Enrichment["sweetness"],
      hop_level: cleanEnum(raw.hop_level, ["low", "med", "high"]) as Enrichment["hop_level"],
      abv: cleanAbv(raw.abv),
    });
  }

  // Preserve input order; rows the model dropped come back as all-nulls so
  // the audit log still records "we tried this id."
  return rows.map(
    (r) =>
      byId.get(r.id) ?? {
        id: r.id,
        style: null,
        flavor_profile: null,
        intended_use: null,
        body: null,
        sweetness: null,
        hop_level: null,
        abv: null,
      },
  );
}

function cleanArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 0 && x.length <= 40);
  if (out.length === 0) return null;
  // Dedupe preserving first occurrence.
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const x of out) {
    if (seen.has(x)) continue;
    seen.add(x);
    deduped.push(x);
    if (deduped.length >= 5) break;
  }
  return deduped;
}

function cleanEnum(v: unknown, allowed: string[]): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return allowed.includes(t) ? t : null;
}

function cleanAbv(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 95) {
    return Math.round(v * 10) / 10;
  }
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0 && n <= 95) return Math.round(n * 10) / 10;
  }
  return null;
}

// ---------------------------------------------------------------------------
// DB I/O
// ---------------------------------------------------------------------------

async function fetchRows(
  client: Client,
  storeId: string | null,
  limit: number | null,
): Promise<InputRow[]> {
  const params: (string | number)[] = [];
  const where: string[] = [
    "is_active = true",
    "name is not null",
    "category in ('wine','beer','spirits','mixer','garnish')",
    // The real gate: at least one of the guided-tree columns is NULL.
    "(style is null or array_length(style, 1) is null" +
      " or flavor_profile is null or array_length(flavor_profile, 1) is null" +
      " or intended_use is null or array_length(intended_use, 1) is null)",
  ];
  if (storeId) {
    params.push(storeId);
    where.push(`store_id = $${params.length}`);
  }
  let sql = `
    select
      id, store_id, name, brand, varietal, category, subcategory,
      description_short, flavor_notes, tasting_notes, summary_for_customer,
      abv,
      style, flavor_profile, intended_use,
      body, sweetness, hop_level
    from public.inventory
    where ${where.join(" and ")}
    order by created_at asc nulls last, id asc
  `;
  if (limit != null) {
    params.push(limit);
    sql += ` limit $${params.length}`;
  }
  const res = await client.query<InputRow>(sql, params);
  return res.rows;
}

async function writeEnrichment(
  client: Client,
  e: Enrichment,
): Promise<{ updated: boolean; changed: string[] }> {
  // Build UPDATE that only touches columns we have non-null values for,
  // AND uses COALESCE so pre-existing values are never clobbered. The
  // combo (explicit filter + coalesce) is belt-and-suspenders: if you
  // re-run after an owner hand-curated something, neither the param
  // nor the coalesce will override it.
  const set: string[] = [];
  const params: unknown[] = [];
  const changed: string[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    set.push(`${col} = coalesce(${col}, $${params.length})`);
    changed.push(col);
  };
  if (e.style) push("style", e.style);
  if (e.flavor_profile) push("flavor_profile", e.flavor_profile);
  if (e.intended_use) push("intended_use", e.intended_use);
  if (e.body) push("body", e.body);
  if (e.sweetness) push("sweetness", e.sweetness);
  if (e.hop_level) push("hop_level", e.hop_level);
  if (e.abv != null) push("abv", e.abv);
  if (set.length === 0) return { updated: false, changed: [] };
  // Always stamp the audit columns so we can tell later which rows this
  // script touched. enrichment_version=2 distinguishes our pass from the
  // CSV-import pass (version 1 by convention).
  set.push(`enriched_at = now()`);
  set.push(`enrichment_version = greatest(enrichment_version, 2)`);
  params.push(e.id);
  const sql = `update public.inventory set ${set.join(", ")} where id = $${params.length}`;
  await client.query(sql, params);
  return { updated: true, changed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type AuditEntry = {
  id: string;
  name: string;
  category: string | null;
  before: {
    style: string[] | null;
    flavor_profile: string[] | null;
    intended_use: string[] | null;
    body: string | null;
    sweetness: string | null;
    hop_level: string | null;
    abv: number | null;
  };
  after: Enrichment;
  written: boolean;
  changed: string[];
};

async function main() {
  const args = parseArgs();

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set. See scripts/apply-migration.ts for format.");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set.");
    process.exit(1);
  }

  console.log("[enrich] starting", {
    write: args.write,
    storeId: args.storeId ?? "(all)",
    limit: args.limit ?? "(unlimited)",
    batchSize: args.batchSize,
    model: args.model,
    output: args.output,
  });

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  // Prepare audit output file.
  const outPath = resolve(args.output);
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        started_at: new Date().toISOString(),
        args,
        entries: "appended below as NDJSON; final summary object at the end",
      },
      null,
      2,
    ) + "\n",
  );

  let processed = 0;
  let written = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let errors = 0;

  try {
    const rows = await fetchRows(client, args.storeId, args.limit);
    console.log(`[enrich] ${rows.length} row(s) need enrichment.`);

    for (let i = 0; i < rows.length; i += args.batchSize) {
      const batch = rows.slice(i, i + args.batchSize);
      const prompt = buildPrompt(batch);
      let parsed: Enrichment[] = [];
      try {
        const { text, inputTokens: it, outputTokens: ot } = await callHaiku(
          args.model,
          prompt,
        );
        inputTokens += it;
        outputTokens += ot;
        parsed = parseResponse(text, batch);
      } catch (e) {
        errors++;
        console.warn(
          `[enrich] batch ${Math.floor(i / args.batchSize)} failed: ${(e as Error).message}`,
        );
        continue;
      }

      for (const [idx, e] of parsed.entries()) {
        const row = batch[idx];
        let writeResult = { updated: false, changed: [] as string[] };
        if (args.write) {
          try {
            writeResult = await writeEnrichment(client, e);
            if (writeResult.updated) written++;
          } catch (err) {
            errors++;
            console.warn(`[enrich] write failed for ${row.id}: ${(err as Error).message}`);
          }
        }
        processed++;

        const entry: AuditEntry = {
          id: row.id,
          name: row.name,
          category: row.category,
          before: {
            style: row.style,
            flavor_profile: row.flavor_profile,
            intended_use: row.intended_use,
            body: row.body,
            sweetness: row.sweetness,
            hop_level: row.hop_level,
            abv: row.abv,
          },
          after: e,
          written: writeResult.updated,
          changed: writeResult.changed,
        };
        appendFileSync(outPath, JSON.stringify(entry) + "\n");

        if (args.verbose) {
          console.log(
            `[enrich] ${row.id.slice(0, 8)} ${row.name.slice(0, 60)}`,
            JSON.stringify({ before: entry.before, after: e, written: writeResult.updated, changed: writeResult.changed }),
          );
        }
      }

      // Progress heartbeat every batch.
      console.log(
        `[enrich] progress: ${processed}/${rows.length} processed, ${written} written, ${errors} errors, tokens: ${inputTokens} in / ${outputTokens} out`,
      );
    }
  } finally {
    await client.end();
  }

  const summary = {
    finished_at: new Date().toISOString(),
    processed,
    written,
    errors,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    // Rough cost at haiku-4-5 list price — $1/Mi, $5/Mo. If Anthropic
    // changes pricing this will drift; it's a sanity check, not billing.
    estimated_cost_usd: Number(
      ((inputTokens * 1) / 1_000_000 + (outputTokens * 5) / 1_000_000).toFixed(4),
    ),
    dry_run: !args.write,
  };
  appendFileSync(outPath, JSON.stringify({ summary }) + "\n");
  console.log("[enrich] done", summary);
  if (!args.write && processed > 0) {
    console.log(`[enrich] DRY RUN — no writes. Re-run with --write to commit.`);
  }
}

main().catch((e) => {
  console.error("[enrich] fatal:", e);
  process.exit(1);
});
