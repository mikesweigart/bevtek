// UPC lookup — Open Food Facts.
//
// OFF is free, no API key, and covers most packaged beverages (beer,
// spirits, mixers). Coverage for fine wine is sparse; that's fine —
// wine providers (CellarTracker, Vivino) plug in later as paid sources.
//
// We intentionally do NOT throw on 404 or rate limit — enrichment must
// degrade gracefully so one flaky provider doesn't break the pipeline.

import type { ProductCore } from "../types";

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";

type OFFProduct = {
  status: number;
  product?: {
    product_name?: string;
    brands?: string;
    image_url?: string;
    image_front_url?: string;
    generic_name?: string;
    ingredients_text?: string;
    // OFF taxonomy tags — useful for category normalization later.
    categories_tags?: string[];
  };
};

export type UpcLookupResult = {
  image_url: string | null;
  description: string | null;
};

/**
 * Resolve UPC → { image_url, description }. Both fields null on miss.
 * Description is whatever OFF has (generic name + ingredients) —
 * the tastingNotes provider decides whether it's enough or if we need
 * to fall back to LLM generation.
 */
export async function lookupByUpc(
  core: ProductCore,
): Promise<UpcLookupResult> {
  const upc = normalizeUpc(core.upc);
  if (!upc) return { image_url: null, description: null };

  const url = `${OFF_BASE}/${upc}.json?fields=product_name,brands,image_url,image_front_url,generic_name,ingredients_text,categories_tags`;

  try {
    const res = await fetch(url, {
      // OFF asks for a descriptive UA. This helps them rate-limit fairly
      // and gives us a path to unblock if we ever hit quota.
      headers: { "User-Agent": "BevTek-Enrichment/1.0 (support@bevtek.ai)" },
      // 5 seconds — OFF is usually fast; past that we'd rather move on.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { image_url: null, description: null };
    const data = (await res.json()) as OFFProduct;
    if (data.status !== 1 || !data.product) {
      return { image_url: null, description: null };
    }

    const img =
      data.product.image_front_url ?? data.product.image_url ?? null;
    const descBits = [
      data.product.generic_name,
      data.product.ingredients_text,
    ].filter((s): s is string => !!s && s.trim().length > 0);

    return {
      image_url: img,
      description: descBits.length > 0 ? descBits.join(" — ") : null,
    };
  } catch {
    // Timeout, DNS, whatever — enrichment continues without this field.
    return { image_url: null, description: null };
  }
}

/** Digits-only, trimmed. Accepts UPC-A (12) or EAN-13; rejects anything else. */
function normalizeUpc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 || digits.length === 13) return digits;
  return null;
}
