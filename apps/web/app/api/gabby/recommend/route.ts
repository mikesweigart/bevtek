import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkRate, identifyRequest, rateLimitResponse } from "@/lib/rate-limit";
import { rerankCandidates, isRerankEnabled } from "@/lib/gabby/rerank";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, init: { status?: number } = {}) {
  return NextResponse.json(body, { status: init.status ?? 200, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Gabby Guided Flow recommend endpoint.
 *
 * Takes the accumulated filter bag from the guided tree and returns the
 * best-matching products. If nothing matches strictly, we relax filters
 * in a predictable cascade (drop price → drop body/hop/sweetness → drop
 * flavor_any → drop style_any) so shoppers always see something rather
 * than a dead-end.
 *
 * Body: {
 *   storeId: string,
 *   filters: {
 *     category?: string,
 *     subcategory?: string,
 *     style_any?: string[],
 *     flavor_any?: string[],
 *     intended_use_any?: string[],
 *     body?: 'light'|'medium'|'full',
 *     sweetness?: 'dry'|'off-dry'|'sweet',
 *     hop_level?: 'low'|'med'|'high',
 *     is_local?: boolean,
 *     price_min?: number,
 *     price_max?: number,
 *     abv_min?: number,            // whiskey proof floor (abv = proof / 2)
 *     abv_max?: number,            // whiskey proof ceiling
 *     brand_any?: string[],        // optional brand preference (ilike-or)
 *   },
 *   limit?: number
 * }
 *
 * Returns: {
 *   products: Product[],
 *   relaxed: string[],   // list of filters we had to drop to find matches
 *   total: number
 * }
 */

type Filters = {
  category?: string;
  subcategory?: string;
  style_any?: string[];
  flavor_any?: string[];
  intended_use_any?: string[];
  // Food-pairing cues from the dinner-pairing guided flow (e.g. "steak",
  // "salmon", "pasta"). Folded into intended_use_any at query time — the
  // inventory_enrichment migration stores pairings there.
  pairing_any?: string[];
  body?: string;
  sweetness?: string;
  hop_level?: string;
  is_local?: boolean;
  price_min?: number;
  price_max?: number;
  // Whiskey-specific: proof bands map to abv (proof = abv × 2).
  // The guided whiskey wizard sets these from the "proof preference" step
  // (low <90, mid 90-100, high 100-120, cask strength 115+).
  abv_min?: number;
  abv_max?: number;
  // Optional brand narrowing from the final step of the whiskey wizard.
  // Case-insensitive OR across the canonical brand column.
  brand_any?: string[];
};

type Row = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  price: number | null;
  stock_qty: number;
  description_short: string | null;
  flavor_notes: string | null;
  tasting_notes: string | null;
  is_staff_pick: boolean | null;
  is_local: boolean | null;
  style: string[] | null;
  flavor_profile: string[] | null;
  intended_use: string[] | null;
  image_url: string | null;
};

const SELECT =
  "id, name, brand, category, subcategory, price, stock_qty, description_short, flavor_notes, tasting_notes, is_staff_pick, is_local, style, flavor_profile, intended_use, image_url";

async function query(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  f: Filters,
  limit: number,
) {
  let q = supabase
    .from("inventory")
    .select(SELECT)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .gt("stock_qty", 0);

  if (f.category) q = q.ilike("category", f.category);
  if (f.subcategory) q = q.ilike("subcategory", f.subcategory);
  if (f.body) q = q.eq("body", f.body);
  if (f.sweetness) q = q.eq("sweetness", f.sweetness);
  if (f.hop_level) q = q.eq("hop_level", f.hop_level);
  if (typeof f.is_local === "boolean") q = q.eq("is_local", f.is_local);
  if (typeof f.price_min === "number") q = q.gte("price", f.price_min);
  if (typeof f.price_max === "number") q = q.lte("price", f.price_max);
  if (typeof f.abv_min === "number") q = q.gte("abv", f.abv_min);
  if (typeof f.abv_max === "number") q = q.lte("abv", f.abv_max);
  if (f.style_any?.length) {
    // Style is the shopper's primary intent ("Bourbon" not "Tequila").
    // We match three ways, OR'd together, because enrichment quality
    // varies store-to-store:
    //   1. style[]       — canonical array set by the enrichment pipeline
    //   2. varietal      — the human-facing "spirit type" column
    //   3. subcategory   — often holds the same word as a free-text label
    // If a row matches ANY of these on ANY token, it qualifies. That way
    // an un-enriched bourbon row with varietal="Bourbon" still lands in
    // results instead of being silently dropped.
    const tokens = f.style_any
      .map((t) => t.trim())
      .filter(Boolean)
      // Strip characters that would break the PostgREST .or() filter
      // string (commas, parens, quotes).
      .map((t) => t.replace(/[,()"'%]/g, ""));
    if (tokens.length) {
      const clauses: string[] = [];
      // Array-overlap filter. PostgREST array syntax: style.ov.{a,b,c}
      // Quote tokens with spaces so the server parses them as one element.
      const arrLit = tokens
        .map((t) => (/[\s]/.test(t) ? `"${t}"` : t))
        .join(",");
      clauses.push(`style.ov.{${arrLit}}`);
      for (const t of tokens) {
        clauses.push(`varietal.ilike.%${t}%`);
        clauses.push(`subcategory.ilike.%${t}%`);
      }
      q = q.or(clauses.join(","));
    }
  }
  if (f.flavor_any?.length) q = q.overlaps("flavor_profile", f.flavor_any);
  if (f.brand_any?.length) {
    // Case-insensitive OR across brands. PostgREST's .or() takes a
    // comma-delimited filter list — we ilike-match each brand so
    // "Maker's Mark" matches "makers mark", "Makers Mark", etc.
    const clauses = f.brand_any
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => `brand.ilike.%${b.replace(/[,()]/g, "")}%`)
      .join(",");
    if (clauses) q = q.or(clauses);
  }
  // Merge pairing cues into intended_use for the overlap query.
  const useCues = [
    ...(f.intended_use_any ?? []),
    ...(f.pairing_any ?? []),
  ];
  if (useCues.length) q = q.overlaps("intended_use", useCues);

  const { data, error } = await q
    .order("is_staff_pick", { ascending: false, nullsFirst: false })
    .order("stock_qty", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Row[];
}

export async function POST(req: Request) {
  let body: { storeId?: string; filters?: Filters; limit?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, { status: 400 });
  }
  const storeId = body.storeId;
  if (!storeId) return json({ error: "storeId required" }, { status: 400 });
  const rl = await checkRate("gabby-recommend", identifyRequest(req, storeId));
  if (!rl.success) return rateLimitResponse(rl);
  const filters: Filters = body.filters ?? {};
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);

  const supabase = await createClient();

  // Relaxation cascade — we try strict first, then progressively drop
  // the pickiest filters. Ordering matters: price is the first to go
  // because shoppers often overstate budget; then subtle attributes
  // (body/hop/sweetness); then the fuzzier "flavor" overlap.
  //
  // We deliberately DO NOT drop `style_any` or `category`/`subcategory`
  // in a way that would widen across spirit types. If a shopper says
  // "I want bourbon," showing them tequila is worse than showing them
  // nothing. Prior versions dropped style as a last resort, which caused
  // Tito's Vodka to appear in bourbon results whenever an un-enriched
  // inventory row had a NULL style[] array. The style matcher now
  // OR's across style[], varietal, and subcategory so we have three
  // chances to hit a real bourbon before giving up.
  const relaxSteps: Array<{ drop: (keyof Filters)[]; label: string }> = [
    { drop: [], label: "" },
    { drop: ["brand_any"], label: "brand" },
    { drop: ["price_min", "price_max"], label: "budget" },
    { drop: ["abv_min", "abv_max"], label: "proof" },
    { drop: ["body", "sweetness", "hop_level"], label: "body" },
    { drop: ["flavor_any"], label: "flavor" },
    { drop: ["intended_use_any", "pairing_any"], label: "occasion" },
  ];

  const relaxed: string[] = [];
  let current: Filters = { ...filters };
  let products: Row[] = [];

  try {
    for (const step of relaxSteps) {
      for (const k of step.drop) delete current[k];
      if (step.label) relaxed.push(step.label);
      products = await query(supabase, storeId, current, limit);
      if (products.length > 0) break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Most likely cause: migration hasn't been applied yet and the new
    // columns don't exist. Fall back to the legacy minimal query so the
    // flow still returns something instead of 500ing.
    try {
      const fallback = await supabase
        .from("inventory")
        .select(
          "id, name, brand, category, subcategory, price, stock_qty, tasting_notes",
        )
        .eq("store_id", storeId)
        .eq("is_active", true)
        .gt("stock_qty", 0)
        .limit(limit);
      return json({
        products: fallback.data ?? [],
        relaxed: ["metadata columns missing — run migration 17"],
        total: fallback.data?.length ?? 0,
        warning: msg,
      });
    } catch {
      return json({ error: msg }, { status: 500 });
    }
  }

  // Only report the relaxations we actually needed (steps before a hit)
  const actuallyRelaxed = relaxed.slice(
    0,
    relaxed.length > 0 && products.length > 0 ? relaxed.length : 0,
  );

  // Optional Haiku re-rank. Inert unless GABBY_RERANK_ENABLED=true on
  // the deployment AND the candidate list has enough room + soft
  // preferences to actually benefit. Any failure falls through to the
  // original order — shoppers never see a broken page because of this.
  // See apps/web/lib/gabby/rerank.ts for the decision logic.
  let justifications: Record<string, string> | undefined;
  let reranked = false;
  if (isRerankEnabled() && products.length > 0) {
    const result = await rerankCandidates(products, filters);
    products = result.products;
    reranked = result.reranked;
    justifications = result.justifications;
  }

  return json({
    products,
    relaxed: actuallyRelaxed,
    total: products.length,
    reranked,
    ...(justifications ? { justifications } : {}),
  });
}
