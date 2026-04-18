// Open Food Facts lookup — UPC first, then name fallback.
//
// OFF is free, no API key, and covers most packaged beverages (beer,
// spirits, mixers). Coverage for fine wine is sparse; that's fine —
// wine providers (CellarTracker, Vivino) plug in later as paid sources.
//
// We intentionally do NOT throw on 404 or rate limit — enrichment must
// degrade gracefully so one flaky provider doesn't break the pipeline.
// HTTP 429 and 5xx get one retry with a 2s backoff before we give up.

import type { ProductCore } from "../types";

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const OFF_SEARCH = "https://world.openfoodfacts.org/cgi/search.pl";
const OFF_TIMEOUT_MS = 10_000; // was 5s; bumped for slower OFF responses
const OFF_HEADERS = {
  "User-Agent": "BevTek-Enrichment/1.0 (support@bevtek.ai)",
};

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

  const data = await fetchOFF<OFFProduct>(url);
  if (!data || data.status !== 1 || !data.product) {
    return { image_url: null, description: null };
  }

  const img = data.product.image_front_url ?? data.product.image_url ?? null;
  const descBits = [
    data.product.generic_name,
    data.product.ingredients_text,
  ].filter((s): s is string => !!s && s.trim().length > 0);

  return {
    image_url: img,
    description: descBits.length > 0 ? descBits.join(" — ") : null,
  };
}

/**
 * Fallback: search OFF by product name + brand when UPC misses or is blank.
 *
 * OFF's search endpoint returns ranked hits; we trust the top result only
 * if the brand appears in the match's brands field (cheap fuzzy-verify to
 * avoid grabbing a random lookalike). Slower than UPC — use as pass 1.b.
 */
export async function searchByName(
  core: ProductCore,
): Promise<UpcLookupResult> {
  if (!core.name || core.name.trim().length < 3) {
    return { image_url: null, description: null };
  }

  const terms = [core.name, core.brand].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    search_terms: terms,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "3",
    fields: "product_name,brands,image_url,image_front_url,generic_name,ingredients_text,code",
  });
  const url = `${OFF_SEARCH}?${params.toString()}`;

  const data = await fetchOFF<OFFSearch>(url);
  if (!data || !data.products || data.products.length === 0) {
    return { image_url: null, description: null };
  }

  // Cheap verification: if the owner gave us a brand, require it to
  // appear in the OFF brands field of the match. Otherwise we take the
  // top hit (name-only matches are noisier but still usually right for
  // distinctive product names).
  const brandNeedle = core.brand?.toLowerCase().trim();
  const pick =
    brandNeedle != null
      ? data.products.find((p) =>
          (p.brands ?? "").toLowerCase().includes(brandNeedle),
        ) ?? null
      : data.products[0];

  if (!pick) return { image_url: null, description: null };

  const img = pick.image_front_url ?? pick.image_url ?? null;
  const descBits = [pick.generic_name, pick.ingredients_text].filter(
    (s): s is string => !!s && s.trim().length > 0,
  );

  return {
    image_url: img,
    description: descBits.length > 0 ? descBits.join(" — ") : null,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * GET an OFF endpoint with one retry on 429/5xx and a 2s backoff. Timeouts,
 * DNS failures, and final non-OK responses resolve to null so callers can
 * treat "no data" and "something went wrong" identically.
 */
async function fetchOFF<T>(url: string): Promise<T | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: OFF_HEADERS,
        signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
      });
      if (res.ok) return (await res.json()) as T;
      // 429 = rate limit, 5xx = transient server error → back off and retry once
      if ((res.status === 429 || res.status >= 500) && attempt === 1) {
        await sleep(2000);
        continue;
      }
      return null;
    } catch {
      if (attempt === 1) {
        await sleep(2000);
        continue;
      }
      return null;
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

type OFFSearch = {
  products?: Array<{
    product_name?: string;
    brands?: string;
    image_url?: string;
    image_front_url?: string;
    generic_name?: string;
    ingredients_text?: string;
    code?: string;
  }>;
};

/** Digits-only, trimmed. Accepts UPC-A (12) or EAN-13; rejects anything else. */
function normalizeUpc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 || digits.length === 13) return digits;
  return null;
}
