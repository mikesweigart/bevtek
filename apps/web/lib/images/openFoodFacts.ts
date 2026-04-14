// Open Food Facts product lookup.
// Free, no API key, rate-limited to 100/min (we stay well under).
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

const OFF_ENDPOINT = "https://world.openfoodfacts.org/api/v2/product";

const USER_AGENT =
  "BevTek-Inventory-Enrichment/0.1 (https://bevtek.ai; contact via app)";

type OFFResponse = {
  status: 0 | 1;
  product?: {
    product_name?: string;
    brands?: string;
    image_url?: string;
    image_front_url?: string;
    image_small_url?: string;
  };
};

export type OFFImage = {
  imageUrl: string;
  productName: string | null;
};

/**
 * A SKU is a real-world UPC/EAN if it's 12-14 digits, all numeric.
 * Shorter numeric codes (8-digit internal SKUs) collide with unrelated
 * products in OFF — we saw a liquor SKU match a random German wheat beer.
 */
export function isLikelyBarcode(sku: string | null): boolean {
  if (!sku) return false;
  const trimmed = sku.trim();
  return /^\d{12,14}$/.test(trimmed);
}

export async function lookupOpenFoodFacts(
  barcode: string,
): Promise<OFFImage | null> {
  if (!isLikelyBarcode(barcode)) return null;
  try {
    const res = await fetch(
      `${OFF_ENDPOINT}/${encodeURIComponent(barcode)}.json?fields=product_name,brands,image_url,image_front_url,image_small_url`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as OFFResponse;
    if (data.status !== 1 || !data.product) return null;
    const img =
      data.product.image_front_url ||
      data.product.image_url ||
      data.product.image_small_url;
    if (!img) return null;
    return {
      imageUrl: img,
      productName: data.product.product_name ?? null,
    };
  } catch {
    return null;
  }
}
