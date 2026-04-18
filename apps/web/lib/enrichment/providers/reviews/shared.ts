// Shared plumbing for the three review providers (Vivino / Untappd /
// Distiller). Each provider is just a tiny config file that specifies
// its domain + any provider-specific query tweaks; the heavy lifting
// (CSE search, page fetch, JSON-LD parse) all lives here.
//
// Why go through Google CSE instead of scraping provider search pages
// directly? Vivino and Untappd both Cloudflare-gate search endpoints
// for anonymous traffic, and the CAPTCHA wall returns a 403 silently.
// Google's crawler has a standing pass, so we let them do the
// discovery and only fetch the specific product page — a one-off hit
// that a normal browser makes looks fine.

const SEARCH_TIMEOUT_MS = 8_000;
const FETCH_TIMEOUT_MS = 10_000;
const HTML_READ_CAP_BYTES = 200 * 1024; // spec: 200 KB

export type ReviewFetchResult = {
  score: number | null;
  count: number | null;
  url: string | null;
};

/**
 * Look up a product on a specific review domain via Google CSE, fetch
 * the top result page, and extract the AggregateRating JSON-LD node.
 * Silent failure at every layer — we return nulls rather than throwing,
 * so the caller doesn't need try/catch scaffolding.
 */
export async function fetchReviewFromProvider(opts: {
  query: string;
  siteSearch: string;
}): Promise<ReviewFetchResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    return { score: null, count: null, url: null };
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cseId);
  url.searchParams.set("q", opts.query);
  url.searchParams.set("num", "3");
  // siteSearch + siteSearchFilter=i locks results to the provider domain
  // even if the owner's CSE cx value is set to "search the entire web".
  url.searchParams.set("siteSearch", opts.siteSearch);
  url.searchParams.set("siteSearchFilter", "i");

  let items: Array<{ link?: string; pagemap?: unknown }>;
  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!res.ok) return { score: null, count: null, url: null };
    const data = (await res.json()) as { items?: typeof items };
    items = data.items ?? [];
  } catch {
    return { score: null, count: null, url: null };
  }

  // Walk top few; prefer a result where JSON-LD lives in pagemap
  // (Google sometimes inlines it) before we fetch the full HTML.
  for (const item of items) {
    const link = item.link;
    if (!link) continue;

    // Try pagemap first — cheaper than a fetch.
    const pagemapHit = tryExtractFromPagemap(item.pagemap);
    if (pagemapHit.score != null) {
      return { ...pagemapHit, url: link };
    }

    // Fall back to fetching the page for the JSON-LD block.
    const html = await fetchHtmlCapped(link);
    if (!html) continue;
    const fromJsonLd = extractAggregateRatingFromHtml(html);
    if (fromJsonLd.score != null) {
      return { ...fromJsonLd, url: link };
    }
    // Last-ditch: og:description regex ("4.2 out of 5").
    const fromOg = extractAggregateRatingFromOgDescription(html);
    if (fromOg.score != null) {
      return { ...fromOg, url: link };
    }
  }

  return { score: null, count: null, url: null };
}

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

type Pagemap = {
  aggregaterating?: Array<Record<string, string>>;
  metatags?: Array<Record<string, string>>;
} | undefined;

function tryExtractFromPagemap(pagemapUnknown: unknown): {
  score: number | null;
  count: number | null;
} {
  const pagemap = pagemapUnknown as Pagemap;
  const ar = pagemap?.aggregaterating?.[0];
  if (ar) {
    const score = parseNumber(ar.ratingvalue ?? ar.ratingValue);
    const count = parseInt10(
      ar.reviewcount ??
        ar.reviewCount ??
        ar.ratingcount ??
        ar.ratingCount ??
        null,
    );
    if (score != null) return { score, count };
  }
  // Some sites expose the rating as plain metatags.
  const meta = pagemap?.metatags?.[0];
  if (meta) {
    const score = parseNumber(
      meta["og:rating"] ??
        meta["product:rating"] ??
        meta["rating"] ??
        null,
    );
    const count = parseInt10(
      meta["og:rating_count"] ??
        meta["product:rating_count"] ??
        meta["rating_count"] ??
        null,
    );
    if (score != null) return { score, count };
  }
  return { score: null, count: null };
}

/**
 * Pull AggregateRating from one of the <script type="application/ld+json">
 * blocks. The schema spec permits an array or a single object, and the
 * AggregateRating can be nested inside a Product / Recipe / etc — we
 * walk the whole tree.
 */
function extractAggregateRatingFromHtml(html: string): {
  score: number | null;
  count: number | null;
} {
  const blocks = extractJsonLdBlocks(html);
  for (const block of blocks) {
    const rating = findAggregateRating(block);
    if (rating) {
      const score = parseNumber(
        (rating as Record<string, unknown>).ratingValue ??
          (rating as Record<string, unknown>).ratingvalue,
      );
      const count = parseInt10(
        (rating as Record<string, unknown>).reviewCount ??
          (rating as Record<string, unknown>).ratingCount ??
          (rating as Record<string, unknown>).reviewcount ??
          (rating as Record<string, unknown>).ratingcount ??
          null,
      );
      if (score != null) return { score, count };
    }
  }
  return { score: null, count: null };
}

function extractJsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      out.push(parsed);
    } catch {
      // Some sites template unescaped quotes in; ignore and move on.
    }
  }
  return out;
}

function findAggregateRating(node: unknown): unknown | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findAggregateRating(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const isRating =
    type === "AggregateRating" ||
    (Array.isArray(type) && type.includes("AggregateRating"));
  if (isRating) return obj;

  // Walk nested: graph, mainEntity, aggregateRating, itemReviewed, etc.
  for (const k of Object.keys(obj)) {
    const hit = findAggregateRating(obj[k]);
    if (hit) return hit;
  }
  return null;
}

function extractAggregateRatingFromOgDescription(html: string): {
  score: number | null;
  count: number | null;
} {
  const ogDesc = html.match(
    /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
  )?.[1];
  if (!ogDesc) return { score: null, count: null };
  const scoreM = ogDesc.match(/(\d+\.\d+)\s*(?:\/|out of)\s*5/i);
  if (!scoreM) return { score: null, count: null };
  const score = parseFloat(scoreM[1]);
  const countM = ogDesc.match(/(\d{1,3}(?:,\d{3})*)\s*(?:reviews|ratings)/i);
  const count = countM ? parseInt(countM[1].replace(/,/g, ""), 10) : null;
  return { score: Number.isFinite(score) ? score : null, count };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function fetchHtmlCapped(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
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
      if (total >= HTML_READ_CAP_BYTES) {
        reader.cancel().catch(() => {});
        break;
      }
    }
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Number coercion helpers — review payloads come back as mixed strings/numbers
// ---------------------------------------------------------------------------

function parseNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function parseInt10(v: unknown): number | null {
  if (v == null) return null;
  const s = typeof v === "number" ? String(v) : String(v);
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
