// Google Custom Search image + description provider.
//
// This is the reliable path for long-tail coverage. Direct scraping of
// retailer sites (TotalWine / Wine.com / ReserveBar) gets blocked by
// Cloudflare on most requests. Google's crawlers have a pass, so we let
// Google do the fetching and just read the results.
//
// We use a Programmable Search Engine (PSE) scoped to the retailer
// domains we trust. The API response embeds og:image from Google's own
// page cache, so on most results we don't even need to fetch the
// product page — we can record the image URL directly. When we do need
// tasting-notes copy, we fall back to fetching the product page (low
// volume, mostly safe because retailers don't block one-off requests
// that come from real browsers with normal referrers).
//
// Env vars required:
//   GOOGLE_API_KEY   — API key with Custom Search API enabled
//   GOOGLE_CSE_ID    — Programmable Search Engine ID (the cx= value)
//
// Cost:
//   100 free queries/day, then $5/1000, capped at $50/day.
//   6,291-row backfill ≈ $30 one-time; new catalog uploads are pennies.

import type { ProductCore } from "../types";

const FETCH_TIMEOUT_MS = 10_000;
const SEARCH_TIMEOUT_MS = 8_000;

export type GoogleSearchResult = {
  image_url: string | null;
  description: string | null;
  /** Which retailer domain won — for the audit trail. */
  source: "retail_site" | null;
};

/** Google's response shape — narrowed to the fields we actually read. */
type CseItem = {
  title?: string;
  link?: string;
  snippet?: string;
  pagemap?: {
    cse_image?: Array<{ src?: string }>;
    cse_thumbnail?: Array<{ src?: string }>;
    metatags?: Array<Record<string, string>>;
  };
};

export async function lookupGoogleSearch(
  core: ProductCore,
): Promise<GoogleSearchResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    // Silent no-op if env isn't configured — keeps the pipeline running
    // in dev without Google credentials.
    return { image_url: null, description: null, source: null };
  }

  const query = buildQuery(core);
  if (!query) return { image_url: null, description: null, source: null };

  const items = await searchGoogle(query, apiKey, cseId);
  if (items.length === 0) {
    return { image_url: null, description: null, source: null };
  }

  // Walk results in rank order. Prefer any result with an og:image we
  // can read from the pagemap directly (no second fetch needed). If
  // only a low-quality thumbnail exists, fall back to fetching the page
  // itself for a clean og:image.
  for (const item of items) {
    if (!item.link) continue;

    const metaImage = item.pagemap?.metatags?.[0]?.["og:image"];
    const pageImage = item.pagemap?.cse_image?.[0]?.src;
    const thumbImage = item.pagemap?.cse_thumbnail?.[0]?.src;

    // og:image from metatags is the highest quality — it's the exact URL
    // the retailer uses for social previews, which is typically a clean
    // product shot at 600–1200px.
    let imageUrl = metaImage ?? pageImage ?? null;
    let description: string | null = item.snippet ?? null;

    // If metatags didn't include og:image, try fetching the product page
    // — Google already surfaced it so the page is findable, and one-off
    // fetches usually slip past bot detection.
    if (!imageUrl || !description) {
      const scraped = await scrapeProductPage(item.link);
      if (!imageUrl && scraped.image_url) imageUrl = scraped.image_url;
      if (scraped.description && scraped.description.length > (description?.length ?? 0)) {
        description = scraped.description;
      }
    }

    // Final fallback: use the tiny thumbnail rather than no image. At
    // least shoppers see *something* representative of the product.
    if (!imageUrl && thumbImage) imageUrl = thumbImage;

    if (imageUrl) {
      return {
        image_url: imageUrl,
        description: description?.trim() || null,
        source: "retail_site",
      };
    }
  }

  return { image_url: null, description: null, source: null };
}

// ---------------------------------------------------------------------------
// Query building
// ---------------------------------------------------------------------------

function buildQuery(core: ProductCore): string | null {
  // Best query is brand + varietal + size — specific enough to rank the
  // exact SKU first, short enough that Google doesn't over-tokenize.
  const parts: string[] = [];
  if (core.brand) parts.push(core.brand);
  if (core.varietal) parts.push(core.varietal);
  if (core.size_label) parts.push(core.size_label);

  // If we don't have a brand (pre-normalization rows), fall back to the
  // raw name — Google handles messy inputs well.
  if (parts.length === 0 && core.name) {
    return core.name.trim().slice(0, 120);
  }
  if (parts.length === 0) return null;

  return parts.join(" ").slice(0, 120);
}

// ---------------------------------------------------------------------------
// Google Custom Search API
// ---------------------------------------------------------------------------

async function searchGoogle(
  query: string,
  apiKey: string,
  cseId: string,
): Promise<CseItem[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cseId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "3"); // top 3 gives us a retry margin
  url.searchParams.set("safe", "active"); // SafeSearch filters junk results

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!res.ok) return []; // quota exceeded, bad cx, etc. — fail soft
    const data = (await res.json()) as { items?: CseItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Product-page scrape (for fuller tasting-notes copy than the snippet)
// ---------------------------------------------------------------------------

async function scrapeProductPage(
  url: string,
): Promise<{ image_url: string | null; description: string | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { image_url: null, description: null };

    // Cap the read at 512KB — og + body block both live in the first
    // few KB of the <head>/<main>.
    const reader = res.body?.getReader();
    let html: string;
    if (!reader) {
      html = await res.text();
    } else {
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
      html = out;
    }

    const image = extractMeta(html, "og:image");
    const body = extractProductBody(html);
    const description =
      (body && body.length >= 60 ? body : null) ??
      extractMeta(html, "og:description") ??
      extractMeta(html, "description");

    return {
      image_url: image ? resolveUrl(image, url) : null,
      description: description?.trim() ?? null,
    };
  } catch {
    return { image_url: null, description: null };
  }
}

// ---------------------------------------------------------------------------
// HTML parsing helpers (shared pattern w/ producerSite + retailLookup)
// ---------------------------------------------------------------------------

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

function extractProductBody(html: string): string | null {
  const text = stripTags(html);
  if (!text) return null;
  const lower = text.toLowerCase();

  // Prefer the block starting at "Tasting Notes" or "Description".
  const anchors = ["tasting notes", "description"];
  for (const anchor of anchors) {
    const idx = lower.indexOf(anchor);
    if (idx === -1) continue;
    const window = text.slice(idx, idx + 1500);
    const cleaned = window.replace(/\s+/g, " ").trim();
    if (cleaned.length >= 60) return cleaned.slice(0, 1500);
  }

  // Fallback: a sentence containing tasting-note vocabulary.
  const m = text.match(
    /[^.\n]{40,400}?\b(nose|palate|finish|tasting notes|aromas? of|flavor(?:s)? of)\b[^.\n]{0,400}\./i,
  );
  if (m && m[0].length >= 60) return m[0].replace(/\s+/g, " ").trim();
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:br|p|div|h[1-6]|li|tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ");
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
