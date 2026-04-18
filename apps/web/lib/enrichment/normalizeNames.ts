// Name normalization — parses the raw CSV name into structured fields.
//
// Why: store exports arrive as a single mashed string:
//   "SUTTER HOME PINOT GRIGIO 1.5 L"
//   "PATRON EXTRA ANEJO TEQUILA 750ml"
//   "NUTRL VODKA SELTZER ORANGE 4PK CAN 12oz"
// Every image/notes/review provider keys off `brand` + optional
// `varietal`. With both null, enrichment whiffs 100% of the time —
// which is exactly what we saw on the first 6,291-row run.
//
// We fix it with one Haiku call per BATCH of ~15 names. Haiku has
// read every liquor catalog on the internet; it nails brand + varietal
// on beverage names the way GPS nails "which highway." Cost at current
// pricing: ~$0.0003 per row, so the full 6,291-row catalog is ~$2.
//
// Idempotent: the caller should only pass rows where brand IS NULL.
// Safe to re-run — first call wins, future calls skip.

import { getAnthropic } from "@/lib/ai/claude";

export type NormalizeInput = {
  id: string;
  name: string;
  category: string | null;
};

export type NormalizedName = {
  id: string;
  /** Producer/brand in Title Case. "Sutter Home", "Jim Beam". */
  brand: string | null;
  /** Grape / spirit type / beer style. "Pinot Grigio", "Bourbon", "IPA". */
  varietal: string | null;
  /** Size in canonical form. "750ml", "1.5L", "6pk 12oz". */
  size_label: string | null;
};

/** Max rows per single Haiku call. JSON stays easy to parse below this. */
const BATCH_SIZE = 15;

/**
 * Normalize a batch of raw names. Returns one NormalizedName per input,
 * in the SAME ORDER, using the SAME ids. Missing fields come back null.
 *
 * Returns an empty array if:
 *  - ANTHROPIC_API_KEY is not configured, OR
 *  - Haiku returned unparseable JSON (callers should retry individually).
 */
export async function normalizeNamesBatch(
  items: NormalizeInput[],
): Promise<NormalizedName[]> {
  if (items.length === 0) return [];
  const claude = getAnthropic();
  if (!claude) return [];

  const prompt = buildPrompt(items);

  try {
    const res = await claude.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return [];

    return parseResponse(block.text, items);
  } catch {
    return [];
  }
}

/**
 * Convenience wrapper: splits a big list into Haiku-sized chunks and
 * flattens the results. Safe to call with the full unenriched set.
 */
export async function normalizeNames(
  items: NormalizeInput[],
): Promise<NormalizedName[]> {
  const out: NormalizedName[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const results = await normalizeNamesBatch(chunk);
    out.push(...results);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prompt + parse
// ---------------------------------------------------------------------------

function buildPrompt(items: NormalizeInput[]): string {
  const input = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
  }));

  return `You are a beverage-catalog normalizer. For each raw product name, extract the brand, varietal, and size.

RULES:
- brand: the producer/label in Title Case. Examples: "Sutter Home", "Jim Beam", "Patron", "Captain Morgan", "Athletic Brewing", "Smoke Wagon". Keep brand names that are well-known compound words intact (e.g., "Maker's Mark", "Woodford Reserve").
- varietal: the grape / spirit type / beer style in Title Case. Examples: "Pinot Grigio", "Cabernet Sauvignon", "Bourbon Whiskey", "Extra Añejo Tequila", "Spiced Rum", "IPA", "Vodka Seltzer", "Red Blend". Be specific but concise (2–4 words max).
- size_label: size in canonical form. Use lowercase "ml", uppercase "L", lowercase "oz", lowercase "pk". Examples: "750ml", "1.5L", "4pk 12oz", "12pk 12oz", "375ml".

IMPORTANT:
- If a field is truly unclear, return null (JSON null, not the string "null"). Don't guess.
- Do NOT invent vintages, proof statements, or region labels that weren't in the source name.
- For ready-to-drink / seltzer / canned cocktails, varietal should describe the drink style ("Vodka Seltzer", "Hard Lemonade", "Canned Old Fashioned") — not just the base spirit.
- Category hints are a tiebreaker, not a ground truth — trust the name text first.

INPUT (JSON array):
${JSON.stringify(input, null, 2)}

OUTPUT: JSON array with one object per input, SAME ORDER, SAME ids, no prose, no markdown fences:
[
  {"id": "<id>", "brand": "Sutter Home", "varietal": "Pinot Grigio", "size_label": "1.5L"},
  ...
]`;
}

function parseResponse(
  text: string,
  items: NormalizeInput[],
): NormalizedName[] {
  // Haiku often wraps JSON in prose ("Here is the normalized data:")
  // despite the prompt saying otherwise. Extract the first top-level
  // array literal and parse that — surrounding prose doesn't matter.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: find the first [...] block that balances brackets.
    // Works even when Haiku prefixed prose like "Here's your JSON:".
    const start = cleaned.indexOf("[");
    if (start === -1) return [];
    // Find the matching close-bracket. We scan naively; nested arrays
    // inside the objects are rare in this response format.
    let depth = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (ch === "[") depth++;
      else if (ch === "]") {
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

  // Build a lookup by id so order/length mismatches don't corrupt rows.
  const byId = new Map<string, NormalizedName>();
  for (const row of parsed as Array<Record<string, unknown>>) {
    const id = typeof row.id === "string" ? row.id : null;
    if (!id) continue;
    byId.set(id, {
      id,
      brand: cleanField(row.brand),
      varietal: cleanField(row.varietal),
      size_label: cleanField(row.size_label),
    });
  }

  // Return in the order we were asked, filling in misses as all-null rows
  // so the caller's upsert still reflects "we tried this id."
  return items.map((i) =>
    byId.get(i.id) ?? {
      id: i.id,
      brand: null,
      varietal: null,
      size_label: null,
    },
  );
}

function cleanField(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  // Model occasionally echoes the word "null" despite instructions.
  if (t.toLowerCase() === "null" || t.toLowerCase() === "unknown") return null;
  // Guardrail: reject anything clearly too long — it's a hallucination.
  if (t.length > 80) return null;
  return t;
}
