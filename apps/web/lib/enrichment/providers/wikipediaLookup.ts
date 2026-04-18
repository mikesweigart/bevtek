// Wikipedia image provider.
//
// Wraps the existing lib/images/wikipedia.ts helpers (already tested in
// the old image-only EnrichButton flow) in the enrichment provider
// contract. Wikipedia images on upload.wikimedia.org are CC-BY-SA or
// public domain — safe to rehost with a "Wikipedia" attribution label
// on the shopper-facing UI.
//
// We prefer the brand article first, then fall back to a product-name
// query for well-known single-product brands (e.g., "Dom Pérignon").

import {
  extractBrandQuery,
  lookupWikipediaImage,
} from "@/lib/images/wikipedia";
import type { ProductCore } from "../types";

export type WikipediaResult = {
  image_url: string | null;
};

export async function lookupWikipedia(
  core: ProductCore,
): Promise<WikipediaResult> {
  // Try the brand first — most consumer brands have Wikipedia articles
  // with a logo or bottle image (Sierra Nevada, Maker's Mark, Tito's).
  const brandQuery = extractBrandQuery({
    brand: core.brand,
    name: core.name,
  });

  if (brandQuery && brandQuery.length >= 2) {
    const hit = await lookupWikipediaImage(brandQuery);
    if (hit?.thumbnailUrl) {
      return { image_url: hit.thumbnailUrl };
    }
  }

  // Fallback: try the full product name for single-product brands
  // (champagne houses, cult wines, canned cocktails, etc.).
  if (core.name && core.name.length >= 3) {
    const hit = await lookupWikipediaImage(core.name);
    if (hit?.thumbnailUrl) {
      return { image_url: hit.thumbnailUrl };
    }
  }

  return { image_url: null };
}
