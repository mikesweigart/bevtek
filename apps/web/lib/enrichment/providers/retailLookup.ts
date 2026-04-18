// Retail-site image + description provider.
//
// For any row the producer-site and Wikipedia passes missed, we fall
// through to specialist retailers whose catalogs cover the long tail:
//
//   TotalWine   — broadest (wines, spirits, beer, RTDs)
//   ReserveBar  — spirits + gift / luxury focus
//   Wine.com    — deepest wine catalog (back vintages, small producers)
//
// The approach mirrors lib/enrichment/providers/producerSite.ts: we
// fetch the retailer's search URL, pick the first product link out of
// the HTML, fetch that product page, and pull its og:image + og:description.
//
// Legal posture: Total Wine / Wine.com / ReserveBar are COMPETITORS, not
// producers. To minimize exposure we:
//   1. Hotlink the retailer's CDN URL instead of downloading + rehosting.
//      (Same thing every search engine does — the image bytes continue
//      to be served by the retailer.)
//   2. Record image_source = "retail_site" for clear audit.
//   3. Respect robots.txt-grade throttling (one request per host at a time,
//      realistic User-Agent, fall back to null on any error).
//
// Reality check: these retailers all sit behind Cloudflare with some
// level of bot detection. A plain fetch gets through *some* of the time
// (we see roughly a 40-60% hit rate empirically). Rows that fall back to
// null from every provider end up with the "image coming soon" placeholder
// — no row ever looks broken, even when every source whiffs.

import type { ProductCore } from "../types";

const FETCH_TIMEOUT_MS = 10_000;

export type RetailResult = {
  image_url: string | null;
  description: string | null;
  /** Which retailer scored — for the image_source audit trail. */
  source: "totalwine" | "reservebar" | "winedotcom" | null;
};

type SiteConfig = {
  name: RetailResult["source"];
  /** Only probe this site when the product category matches, if set. */
  categories: Set<string> | null;
  searchUrl: (query: string) => string;
  /**
   * Extract the first product page URL from search-results HTML.
   * Returns an absolute URL.
   */
  findFirstProductUrl: (html: string) => string | null;
};

const SITES: SiteConfig[] = [
  {
    name: "totalwine",
    // Broadest selection — try on everything.
    categories: null,
    searchUrl: (q) =>
      `https://www.totalwine.com/search/all?text=${encodeURIComponent(q)}`,
    findFirstProductUrl: (html) => {
      // Total Wine product URLs contain "/p/" followed by a slug + numeric id.
      //   /wine/red-wine/cabernet-sauvignon/caymus-cabernet-napa-valley/p/0156201750
      const m = html.match(/href="(\/[^"]*\/p\/\d+)"/i);
      return m ? `https://www.totalwine.com${m[1]}` : null;
    },
  },
  {
    name: "reservebar",
    categories: new Set(["spirits", "mixer"]),
    searchUrl: (q) =>
      `https://www.reservebar.com/search?q=${encodeURIComponent(q)}`,
    findFirstProductUrl: (html) => {
      // ReserveBar product URLs look like /products/<slug>.
      const m = html.match(/href="(\/products\/[^"?#]+)"/i);
      return m ? `https://www.reservebar.com${m[1]}` : null;
    },
  },
  {
    name: "winedotcom",
    categories: new Set(["wine"]),
    searchUrl: (q) =>
      `https://www.wine.com/search/${encodeURIComponent(q)}/0`,
    findFirstProductUrl: (html) => {
      // Wine.com product URLs: /product/<slug>/<id>
      const m = html.match(/href="(\/product\/[^"?#]+\/\d+)"/i);
      return m ? `https://www.wine.com${m[1]}` : null;
    },
  },
];

/**
 * Try each applicable retailer in priority order. Returns the first hit
 * (image + optional description) or {null, null, null} on total miss.
 */
export async function lookupRetailSite(
  core: ProductCore,
): Promise<RetailResult> {
  const query = buildQuery(core);
  if (!query) return { image_url: null, description: null, source: null };

  const cat = (core.category ?? "").toLowerCase();

  for (const site of SITES) {
    if (site.categories && !site.categories.has(cat)) continue;

    const hit = await probeSite(site, query);
    if (hit?.image_url) {
      return { ...hit, source: site.name };
    }
  }

  return { image_url: null, description: null, source: null };
}

function buildQuery(core: ProductCore): string | null {
  // Strongest signal: brand + varietal + size. Fall back to raw name if
  // we haven't normalized yet (though by this point in the pipeline the
  // normalization pass will have run).
  const parts: string[] = [];
  if (core.brand) parts.push(core.brand);
  // varietal lives outside ProductCore today — the raw name carries it,
  // which is fine because retailer search engines tokenize aggressively.
  if (parts.length === 0) {
    return core.name?.trim() || null;
  }
  // Append a cleaned version of the name so the varietal + any other
  // distinguishing descriptors make it into the query.
  if (core.name) {
    const tail = core.name
      .replace(new RegExp(core.brand ?? "", "i"), "")
      .replace(/\s+/g, " ")
      .trim();
    if (tail) parts.push(tail);
  }
  if (core.size_label) parts.push(core.size_label);
  return parts.join(" ").slice(0, 120);
}

// ---------------------------------------------------------------------------
// Per-site probe
// ---------------------------------------------------------------------------

async function probeSite(
  site: SiteConfig,
  query: string,
): Promise<{ image_url: string | null; description: string | null } | null> {
  try {
    // 1. Search for the product.
    const searchHtml = await fetchHtml(site.searchUrl(query));
    if (!searchHtml) return null;

    const productUrl = site.findFirstProductUrl(searchHtml);
    if (!productUrl) return null;

    // 2. Fetch the product page and pull Open Graph tags.
    const productHtml = await fetchHtml(productUrl);
    if (!productHtml) return null;

    const image = extractMeta(productHtml, "og:image");

    // Prefer the structured product copy (Description + TASTING NOTES
    // body block) over og:description — og:description on retailers is
    // usually a short SEO stub ("Shop Bacardí Superior 750ml — Free
    // Shipping"), whereas the page body carries the real tasting content.
    const body = extractProductBody(productHtml);
    const description =
      (body && body.length >= 60 ? body : null) ??
      extractMeta(productHtml, "og:description") ??
      extractMeta(productHtml, "description");

    if (!image) return null;

    return {
      image_url: resolveUrl(image, productUrl),
      description: description?.trim() ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // Realistic UA — most bot detection is UA-based first pass.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    // Cap at 512KB — product pages can be large but og tags are in <head>.
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const decoder = new TextDecoder("utf-8");
    let out = "";
    let total = 0;
    const cap = 512 * 1024;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (total >= cap) {
        reader.cancel().catch(() => {});
        break;
      }
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Heuristic extraction of the product description + tasting notes block
 * from a retailer product page. Handles the common pattern:
 *
 *   Description
 *   <paragraph about the brand / product history>
 *   TASTING NOTES
 *   <paragraph>
 *   Nose: ...
 *   Palate: ...
 *   Finish: ...
 *
 * Strategy: strip HTML to plain text, then scan for our anchor words
 * ("description" / "tasting notes" / "nose" / "palate" / "finish")
 * and return a window of text around them. We deliberately pull too
 * much rather than too little — the downstream Haiku distillation
 * step does the tight summary.
 */
function extractProductBody(html: string): string | null {
  const text = stripTags(html);
  if (!text) return null;

  const lower = text.toLowerCase();

  // Prefer the block that starts at "Description" or "Tasting Notes"
  // if we can find one; otherwise fall back to the longest paragraph
  // that mentions nose/palate/finish.
  const anchors = ["tasting notes", "description"];
  for (const anchor of anchors) {
    const idx = lower.indexOf(anchor);
    if (idx === -1) continue;
    // Grab ~1500 chars forward — enough to include Nose/Palate/Finish
    // but not so much we pull unrelated footer content.
    const window = text.slice(idx, idx + 1500);
    const cleaned = window.replace(/\s+/g, " ").trim();
    if (cleaned.length >= 60) return cleaned.slice(0, 1500);
  }

  // Fallback: find a sentence that looks like tasting-note language.
  const m = text.match(
    /[^.\n]{40,400}?\b(nose|palate|finish|tasting notes|aromas? of|flavor(?:s)? of)\b[^.\n]{0,400}\./i,
  );
  if (m && m[0].length >= 60) {
    return m[0].replace(/\s+/g, " ").trim();
  }

  return null;
}

function stripTags(html: string): string {
  return html
    // Drop script/style blocks wholesale — they pollute the text with code.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    // Turn block tags into newlines so the section anchors survive.
    .replace(/<\/?(?:br|p|div|h[1-6]|li|tr)\b[^>]*>/gi, "\n")
    // Strip remaining tags.
    .replace(/<[^>]+>/g, " ")
    // Decode common entities.
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Collapse whitespace per-line so anchor phrases match cleanly.
    .replace(/[ \t]+/g, " ");
}

function extractMeta(html: string, key: string): string | null {
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeReg(key)}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
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
