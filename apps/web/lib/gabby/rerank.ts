// Gabby recommend re-rank — optional LLM post-step.
//
// After the SQL/PostgREST relaxation cascade produces a candidate list of
// inventory rows that match the shopper's hard filters (category, budget,
// style, etc.), this module optionally hands the candidates to Claude
// along with the shopper's SOFT preferences (flavor tokens, intended use,
// pairings) and asks it to re-rank the list so the best fit surfaces
// first.
//
// WHY NOT JUST SQL?
//   Soft preferences are ambiguous. "Beginner-friendly and fruity for a
//   gift" maps to dozens of candidates after relaxation; the order
//   matters. SQL ordering is `is_staff_pick then stock_qty`, which is
//   store-economics-optimal, not shopper-preference-optimal. Claude has
//   read every tasting note for every bottle ever written; it can
//   surface the bourbon whose producer copy says "caramel and honey on
//   the nose, smooth enough for a first-timer" over the one that just
//   says "barrel aged, 100 proof." That's a real quality lift — at
//   ~$0.01 and ~1s extra latency per call.
//
// FEATURE FLAG:
//   Default OFF. Set GABBY_RERANK_ENABLED=true in Vercel env to enable.
//   This way we ship the code dormant, A/B test via a subset of deploys,
//   and can kill it instantly by flipping the flag if it regresses.
//
// FAILURE MODE:
//   If Claude errors, times out, or returns unparseable output, we
//   silently fall back to the original order. Shoppers never see a
//   broken page because of a re-rank miss.

import { getAnthropic, isAIConfigured } from "@/lib/ai/claude";

// Kept loose on purpose — the route's Row type has many fields we don't
// need for re-ranking. We only expect the shape below.
export type Candidate = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  price: number | null;
  tasting_notes?: string | null;
  flavor_notes?: string | null;
  description_short?: string | null;
  style?: string[] | null;
  flavor_profile?: string[] | null;
  intended_use?: string[] | null;
};

export type RerankFilters = {
  category?: string;
  subcategory?: string;
  style_any?: string[];
  flavor_any?: string[];
  intended_use_any?: string[];
  pairing_any?: string[];
  body?: string;
  sweetness?: string;
  hop_level?: string;
  price_min?: number;
  price_max?: number;
  abv_min?: number;
  abv_max?: number;
  brand_any?: string[];
};

export type RerankResult<T extends Candidate> = {
  products: T[];
  reranked: boolean;
  reason?: string; // diagnostic — why we skipped/applied rerank
  justifications?: Record<string, string>; // productId → one-line why
};

// ---------------------------------------------------------------------------
// Decide whether to invoke re-rank.
// ---------------------------------------------------------------------------

export function isRerankEnabled(): boolean {
  return process.env.GABBY_RERANK_ENABLED === "true" && isAIConfigured();
}

/**
 * Re-rank only fires when it can actually lift quality. Guards:
 *   - at least 3 candidates (otherwise there's nothing to reorder)
 *   - at most 20 candidates (input-token budget; above this we'd want
 *     to pre-trim by embedding similarity)
 *   - at least ONE soft preference signal is set — if the shopper only
 *     gave hard constraints, the SQL order is already optimal.
 */
function hasSoftSignals(f: RerankFilters): boolean {
  return Boolean(
    (f.flavor_any && f.flavor_any.length > 0) ||
      (f.intended_use_any && f.intended_use_any.length > 0) ||
      (f.pairing_any && f.pairing_any.length > 0) ||
      f.body ||
      f.sweetness ||
      f.hop_level,
  );
}

function shouldRerank<T extends Candidate>(
  products: T[],
  filters: RerankFilters,
): { ok: boolean; reason: string } {
  if (!isRerankEnabled()) return { ok: false, reason: "flag-off" };
  if (products.length < 3) return { ok: false, reason: "too-few-candidates" };
  if (products.length > 20) return { ok: false, reason: "too-many-candidates" };
  if (!hasSoftSignals(filters)) return { ok: false, reason: "no-soft-signals" };
  return { ok: true, reason: "ok" };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function describeFilters(f: RerankFilters): string {
  const parts: string[] = [];
  if (f.category) parts.push(`category: ${f.category}`);
  if (f.subcategory) parts.push(`subcategory: ${f.subcategory}`);
  if (f.style_any?.length) parts.push(`style preferences: ${f.style_any.join(", ")}`);
  if (f.flavor_any?.length) parts.push(`flavor preferences: ${f.flavor_any.join(", ")}`);
  if (f.intended_use_any?.length) parts.push(`intended use: ${f.intended_use_any.join(", ")}`);
  if (f.pairing_any?.length) parts.push(`food pairing: ${f.pairing_any.join(", ")}`);
  if (f.body) parts.push(`body: ${f.body}`);
  if (f.sweetness) parts.push(`sweetness: ${f.sweetness}`);
  if (f.hop_level) parts.push(`hop level: ${f.hop_level}`);
  if (f.price_min != null || f.price_max != null) {
    parts.push(
      `budget: ${f.price_min != null ? `$${f.price_min}` : "$0"}-${f.price_max != null ? `$${f.price_max}` : "$∞"}`,
    );
  }
  if (f.abv_min != null || f.abv_max != null) {
    parts.push(`abv: ${f.abv_min ?? "?"}-${f.abv_max ?? "?"}`);
  }
  if (f.brand_any?.length) parts.push(`brand preferences: ${f.brand_any.join(", ")}`);
  return parts.join(" | ");
}

function describeCandidate(c: Candidate): string {
  const parts = [c.name];
  if (c.brand) parts.push(`(${c.brand})`);
  const price = c.price != null ? `$${Number(c.price).toFixed(2)}` : "price N/A";
  parts.push(`— ${price}`);
  const notes = c.tasting_notes ?? c.flavor_notes ?? c.description_short ?? null;
  let line = parts.join(" ");
  if (c.style?.length) line += ` | style: ${c.style.slice(0, 4).join(", ")}`;
  if (c.flavor_profile?.length) line += ` | flavors: ${c.flavor_profile.slice(0, 5).join(", ")}`;
  if (c.intended_use?.length) line += ` | use: ${c.intended_use.slice(0, 3).join(", ")}`;
  if (notes) {
    const n = notes.length > 180 ? notes.slice(0, 177).trimEnd() + "…" : notes;
    line += `\n    · ${n}`;
  }
  return line;
}

function buildPrompt<T extends Candidate>(
  products: T[],
  filters: RerankFilters,
): string {
  const list = products
    .map((p, i) => `[${i}] id=${p.id}\n${describeCandidate(p)}`)
    .join("\n\n");
  return `You are helping order a retail shopper's candidate beverage list so the best fit for THEIR stated preferences surfaces first.

SHOPPER PREFERENCES (all provided — respect them):
${describeFilters(filters)}

CANDIDATES (hard filters already passed — your job is to ORDER them):
${list}

Return a JSON object with this exact shape:
{
  "ranked": ["<id>", "<id>", "<id>", ...],
  "justifications": {
    "<id>": "one short sentence on why this ranks where it does, grounded in the preferences"
  }
}

RULES:
- "ranked" MUST contain every input id exactly once.
- "justifications" should cover the top 3–5 only; skip the rest.
- Base your ranking on how well each bottle's tasting notes / style / flavor / intended_use match the shopper's preferences. The producer's own words (the indented "·" lines) are your highest-quality signal.
- Don't invent flavors or claims the candidate doesn't actually carry in its notes/style/flavor_profile.
- Output ONLY the JSON object, no prose, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

type RerankOutput = {
  ranked: string[];
  justifications: Record<string, string>;
};

function parseOutput(text: string): RerankOutput | null {
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  // If the model wrapped in prose, grab the first balanced {...}.
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    if (start === -1) return null;
    let depth = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      else if (cleaned[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return null;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Partial<RerankOutput>;
  if (!Array.isArray(obj.ranked)) return null;
  const ranked = obj.ranked.filter((x): x is string => typeof x === "string");
  if (ranked.length === 0) return null;
  const justRaw = obj.justifications;
  const justifications: Record<string, string> = {};
  if (justRaw && typeof justRaw === "object") {
    for (const [k, v] of Object.entries(justRaw)) {
      if (typeof v === "string" && v.trim().length > 0) justifications[k] = v.trim();
    }
  }
  return { ranked, justifications };
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 2500;

export async function rerankCandidates<T extends Candidate>(
  products: T[],
  filters: RerankFilters,
): Promise<RerankResult<T>> {
  const decision = shouldRerank(products, filters);
  if (!decision.ok) {
    return { products, reranked: false, reason: decision.reason };
  }
  const claude = getAnthropic();
  if (!claude) return { products, reranked: false, reason: "no-ai-client" };

  const prompt = buildPrompt(products, filters);
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const message = await claude.messages.create(
      {
        model: "claude-haiku-4-5",
        max_tokens: 600,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: ac.signal },
    );
    clearTimeout(timeout);

    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { products, reranked: false, reason: "no-text-block" };
    }
    const parsed = parseOutput(block.text);
    if (!parsed) return { products, reranked: false, reason: "parse-failed" };

    // Build new ordering. Anything the model dropped goes to the end in
    // original order so we never accidentally hide a candidate.
    const byId = new Map(products.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const reordered: T[] = [];
    for (const id of parsed.ranked) {
      const p = byId.get(id);
      if (p && !seen.has(id)) {
        reordered.push(p);
        seen.add(id);
      }
    }
    for (const p of products) {
      if (!seen.has(p.id)) reordered.push(p);
    }

    // Light observability — correlates prompt version with cost/latency.
    // Stays in Vercel's function log; no PII.
    // eslint-disable-next-line no-console
    console.log(
      "[gabby.rerank]",
      JSON.stringify({
        ok: true,
        count: products.length,
        reason: decision.reason,
        input_tokens: message.usage?.input_tokens ?? null,
        output_tokens: message.usage?.output_tokens ?? null,
      }),
    );

    return {
      products: reordered,
      reranked: true,
      reason: "ok",
      justifications: parsed.justifications,
    };
  } catch (e) {
    clearTimeout(timeout);
    const name = (e as Error)?.name ?? "UnknownError";
    // AbortError = we tripped the timeout. Anything else is a real miss
    // (5xx, network, rate-limit). Either way: fall back silently.
    // eslint-disable-next-line no-console
    console.warn(
      "[gabby.rerank]",
      JSON.stringify({ ok: false, error: name, count: products.length }),
    );
    return { products, reranked: false, reason: name };
  }
}
