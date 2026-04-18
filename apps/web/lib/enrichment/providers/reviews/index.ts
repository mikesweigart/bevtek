// Category-routed review lookup. Takes a product core, inspects its
// category, and dispatches to the right provider. Returns nulls for
// categories we don't have a consensus review source for (RTDs, canned
// cocktails, mixers, garnish) — those stay review-less until we find a
// source worth trusting.

import type { ProductCore } from "../../types";
import type { ReviewSource } from "../../types";
import { lookupVivino } from "./vivino";
import { lookupUntappd } from "./untappd";
import { lookupDistiller } from "./distiller";

export type ReviewLookupResult = {
  score: number | null;
  count: number | null;
  source: ReviewSource | null;
  url: string | null;
};

export async function getReviews(
  core: ProductCore,
): Promise<ReviewLookupResult> {
  const bucket = routeCategory(core.category);
  if (!bucket) return empty();

  if (bucket === "vivino") {
    const r = await lookupVivino(core);
    return r.score != null ? { ...r, source: "vivino" } : empty();
  }
  if (bucket === "untappd") {
    const r = await lookupUntappd(core);
    return r.score != null ? { ...r, source: "untappd" } : empty();
  }
  if (bucket === "distiller") {
    const r = await lookupDistiller(core);
    return r.score != null ? { ...r, source: "distiller" } : empty();
  }
  return empty();
}

function empty(): ReviewLookupResult {
  return { score: null, count: null, source: null, url: null };
}

/**
 * Map raw category text (possibly messy/free-form from CSVs) to the
 * review-provider bucket. We lowercase + substring-match rather than
 * exact-equals because the raw `category` column is free text (the
 * classifier in lib/inventory/categoryGroup.ts is what normalizes, but
 * runs after this). Returning null = skip this row.
 */
function routeCategory(
  category: string | null,
): "vivino" | "untappd" | "distiller" | null {
  if (!category) return null;
  const c = category.toLowerCase();

  // Wine — route to Vivino.
  if (/\bwine\b|champagne|sparkling|prosecco|cava|sake|vermouth|port|sherry|madeira/.test(c)) {
    return "vivino";
  }
  // Beer / cider — route to Untappd. Explicitly exclude seltzers & RTDs
  // because Untappd's coverage of those is inconsistent and misleading.
  if (/\bbeer\b|\bale\b|lager|ipa|stout|porter|pilsner|cider|perry|hefeweizen|saison/.test(c)) {
    return "untappd";
  }
  // Spirits — route to Distiller. Covers whiskey/scotch/bourbon/rye,
  // tequila/mezcal, rum, gin, cognac/brandy, liqueurs.
  if (
    /whiskey|whisky|bourbon|scotch|rye|tequila|mezcal|rum|\bgin\b|cognac|brandy|liqueur|cordial|vodka/.test(
      c,
    )
  ) {
    return "distiller";
  }
  // RTDs, hard seltzers, mixers, non-alcoholic — no consensus source yet.
  return null;
}
