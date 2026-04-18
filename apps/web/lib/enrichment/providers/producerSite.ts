// Producer-site image + description provider.
//
// For well-known brands, we take the brand name, guess the likeliest
// domain patterns, and scrape the home page for its Open Graph image
// and description. Producer sites are very consistent about using
// <meta property="og:image"> — it's what every social platform uses to
// preview the URL, so virtually every marketing site sets it.
//
// Legal posture: we're a licensed retailer displaying a product we
// actually sell, using the brand's own marketing image. This is the
// same posture Amazon, Instacart, or any retail aggregator takes. We
// only fetch if the homepage returns 200 and an og:image within 10s.
//
// We keep the domain-guessing dead simple — no third-party domain
// resolver, no Google "site:" queries. Most wine/spirit/beer brands
// register one of a small handful of predictable patterns. We stop at
// the first hit.

import type { ProductCore } from "../types";

const FETCH_TIMEOUT_MS = 10_000;

export type ProducerResult = {
  image_url: string | null;
  description: string | null;
};

export async function lookupProducerSite(
  core: ProductCore,
): Promise<ProducerResult> {
  const brand = normalizeBrand(core.brand);
  if (!brand) return { image_url: null, description: null };

  const candidates = buildDomainCandidates(brand, core.category);

  for (const domain of candidates) {
    const result = await tryFetchHomepage(domain);
    if (result?.image_url) return result;
  }

  return { image_url: null, description: null };
}

// ---------------------------------------------------------------------------
// Domain candidate building
// ---------------------------------------------------------------------------

function normalizeBrand(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 2) return null;
  // "Tito's Handmade Vodka" → "titos"
  // "Silver Oak" → "silveroak"
  // "Maker's Mark" → "makersmark"
  return trimmed
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * For a normalized brand like "silveroak" in category wine, we try:
 *   silveroak.com
 *   silveroakcellars.com
 *   silveroakwinery.com     (wine)
 *   silveroakwines.com      (wine)
 *   silveroakdistillery.com (spirits)
 *   silveroakbrewing.com    (beer)
 *   drinksilveroak.com      (any)
 *
 * Order matters — cheapest/most-common first. We stop at the first hit
 * so each additional candidate only costs if earlier ones missed.
 */
function buildDomainCandidates(
  brand: string,
  category: string | null,
): string[] {
  const c = (category ?? "").toLowerCase();
  const bases = [brand, `drink${brand}`];

  const suffixes: string[] = [];
  if (c === "wine") {
    suffixes.push("cellars", "winery", "vineyards", "wines", "estate");
  } else if (c === "beer") {
    suffixes.push("brewing", "brewery", "brew");
  } else if (c === "spirits") {
    suffixes.push("distillery", "distilling", "spirits", "whiskey", "bourbon");
  }

  const withSuffixes = suffixes.map((s) => `${brand}${s}`);

  const all = [...bases, ...withSuffixes];
  // De-dup while preserving order.
  const seen = new Set<string>();
  return all
    .filter((b) => {
      if (seen.has(b)) return false;
      seen.add(b);
      return true;
    })
    .map((b) => `${b}.com`);
}

// ---------------------------------------------------------------------------
// Fetch + OpenGraph parse
// ---------------------------------------------------------------------------

async function tryFetchHomepage(
  domain: string,
): Promise<ProducerResult | null> {
  const url = `https://${domain}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BevTekBot/1.0; +https://bevtek.ai)",
        Accept: "text/html,application/xhtml+xml",
      },
      // Redirects are fine (brand-only → www.brand.com is the norm).
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    // Only read the first 512KB — og:image is always in <head>, we don't
    // need the full page body.
    const html = await readLimited(res, 512 * 1024);

    const image = extractMeta(html, "og:image");
    const description =
      extractMeta(html, "og:description") ??
      extractMeta(html, "description");

    if (!image) return null;

    return {
      image_url: resolveUrl(image, url),
      description: description?.trim() ?? null,
    };
  } catch {
    return null;
  }
}

async function readLimited(res: Response, maxBytes: number): Promise<string> {
  // Stream + cut. Most homepages are < 200KB; OG tags are always in the
  // first few KB. This caps memory and speeds up parsing.
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder("utf-8");
  let out = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (total >= maxBytes) {
      reader.cancel().catch(() => {});
      break;
    }
  }
  return out;
}

/**
 * Extract a meta tag's content. Order-insensitive about property/name
 * attributes and single/double quotes. Deliberately simple regex — a
 * full HTML parser would be overkill here.
 */
function extractMeta(html: string, key: string): string | null {
  // property="og:image" content="..."
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeReg(key)}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  // content="..." property="og:image"  (attribute order reversed)
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escapeReg(key)}["']`,
    "i",
  );
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveUrl(maybeRelative: string, base: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}
