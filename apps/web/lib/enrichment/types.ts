// Shared types for the enrichment pipeline.
//
// Each provider is a pure async function that takes the bare product
// "core" (what we know from the CSV) and returns a Partial<EnrichmentResult>.
// The orchestrator merges results from successive providers, preferring
// earlier/higher-priority hits, and computes a final source_confidence.

export type ProductCore = {
  /** Stable inventory row id so we can write back. */
  id: string;
  /** Store scope — used when rehosting images to Supabase Storage. */
  store_id: string;
  name: string;
  brand: string | null;
  /** Normalized: 'wine' | 'beer' | 'spirits' | 'mixer' | 'garnish'. */
  category: string | null;
  /** Grape / spirit type / beer style — "Pinot Grigio", "Bourbon", "IPA". */
  varietal: string | null;
  /** Raw UPC/EAN from the CSV, digits only. */
  upc: string | null;
  /** Human-readable size — "750ml", "6 pk 12oz". */
  size_label: string | null;
};

export type EnrichmentResult = {
  image_url: string | null;
  /** Where the image came from — for confidence scoring + audit. */
  image_source: ImageSource | null;

  tasting_notes: string | null;
  tasting_notes_source: TastingNotesSource | null;

  summary_for_customer: string | null;

  average_rating: number | null;
  review_count: number | null;
  review_summary: string | null;
  review_source: ReviewSource | null;
};

export type ImageSource =
  | "cache"
  | "open_food_facts"
  | "wikipedia"
  | "producer_site"
  | "retail_site"
  | "placeholder"
  | "store_supplied"
  | null;

export type TastingNotesSource =
  | "cache"
  | "open_food_facts"
  | "producer_site"
  | "retail_site"
  | "generated";

export type ReviewSource = "vivino" | "untappd" | "distiller";

/** Finalized confidence tier — see docs/inventory-import-and-enrichment.md §3.2. */
export type SourceConfidence =
  | "verified"
  | "high"
  | "medium"
  | "low"
  | "partial"
  | "none";

/**
 * Empty result — every provider contributes only what it found, so the
 * orchestrator starts here and merges forward.
 */
export function emptyResult(): EnrichmentResult {
  return {
    image_url: null,
    image_source: null,
    tasting_notes: null,
    tasting_notes_source: null,
    summary_for_customer: null,
    average_rating: null,
    review_count: null,
    review_summary: null,
    review_source: null,
  };
}

/**
 * Merge a partial result INTO an accumulator, but only fill fields that
 * are still null. First provider wins — higher-priority providers run first.
 */
export function mergePartial(
  acc: EnrichmentResult,
  partial: Partial<EnrichmentResult>,
): EnrichmentResult {
  const out = { ...acc };
  for (const key of Object.keys(partial) as (keyof EnrichmentResult)[]) {
    if (out[key] == null && partial[key] != null) {
      // Type-safe only because both sides share the same key set.
      (out[key] as EnrichmentResult[typeof key]) = partial[
        key
      ] as EnrichmentResult[typeof key];
    }
  }
  return out;
}
