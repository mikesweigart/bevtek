// source_confidence scoring.
//
// The view gabby_ready_inventory filters on image + notes presence; this
// function assigns a qualitative tier that the ranker can use to
// *de-boost* weak matches. A product can be Gabby-ready AND low-confidence
// — e.g., LLM-generated notes + fuzzy-matched image. We still show it,
// but after the verified picks.

import type {
  EnrichmentResult,
  ImageSource,
  SourceConfidence,
  TastingNotesSource,
} from "./types";

/**
 * verified = hit our internal cache (we've vetted this UPC for another store)
 * high     = both fields sourced from a structured external provider by UPC
 * medium   = one provider hit, one fuzzy/fallback
 * low      = both fallback, or notes were LLM-generated
 * partial  = image OR notes missing (hidden from Gabby)
 * none     = both missing (hidden from Gabby)
 */
export function scoreConfidence(r: EnrichmentResult): SourceConfidence {
  const hasImage = !!r.image_url;
  const hasNotes = !!r.tasting_notes && r.tasting_notes.trim().length >= 20;

  if (!hasImage && !hasNotes) return "none";
  if (!hasImage || !hasNotes) return "partial";

  const imgTier = imageTier(r.image_source);
  const notesTier = notesTier_(r.tasting_notes_source);

  // Both cache → verified.
  let tier: SourceConfidence;
  if (imgTier === "cache" && notesTier === "cache") tier = "verified";
  else if (imgTier === "provider" && notesTier === "provider") tier = "high";
  else if (
    (imgTier === "provider" && notesTier === "fallback") ||
    (imgTier === "fallback" && notesTier === "provider")
  ) {
    tier = "medium";
  } else {
    tier = "low";
  }

  // Review-score bump. A real community rating from Vivino/Untappd/
  // Distiller is stronger trust-ground than any scraped image or
  // distilled description — so if we have one, bump one tier. Caps at
  // verified (cache + cache was already there).
  if (r.review_score != null && r.review_count != null && r.review_count >= 25) {
    if (tier === "medium") tier = "high";
    else if (tier === "low") tier = "medium";
    else if (tier === "high") tier = "verified";
  }

  return tier;
}

function imageTier(s: ImageSource | null): "cache" | "provider" | "fallback" {
  if (s === "cache") return "cache";
  if (s === "open_food_facts" || s === "producer_site" || s === "retail_site") {
    return "provider";
  }
  if (s === "wikipedia") return "fallback"; // usually a logo, not a bottle
  if (s === "placeholder") return "fallback"; // honest "coming soon" card
  return "fallback"; // store_supplied / null
}

function notesTier_(
  s: TastingNotesSource | null,
): "cache" | "provider" | "fallback" {
  if (s === "cache") return "cache";
  if (s === "open_food_facts" || s === "producer_site" || s === "retail_site") {
    return "provider";
  }
  return "fallback"; // generated / null
}
