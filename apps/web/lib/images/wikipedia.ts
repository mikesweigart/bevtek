// Fetch brand / product images from Wikipedia via the MediaWiki API.
// No API key required. Images returned are on upload.wikimedia.org and are
// free-licensed (CC-BY-SA or public domain), used here with a "Wikipedia"
// attribution label on the shopper UI.

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT =
  "BevTek-Inventory-Enrichment/0.1 (https://bevtek.ai; contact via app)";

type WikiResponse = {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        thumbnail?: { source: string; width: number; height: number };
        original?: { source: string };
        missing?: "";
      }
    >;
    redirects?: Array<{ from: string; to: string }>;
  };
};

export type WikipediaImage = {
  title: string;
  thumbnailUrl: string;
  articleUrl: string;
};

/**
 * Extract a reasonable brand / search term from an item name and brand field.
 * Strategy: prefer explicit brand, else take the first 1-3 significant words
 * (skip *XXX* distributor prefixes, leading numbers/symbols).
 */
export function extractBrandQuery(opts: {
  brand: string | null;
  name: string;
}): string {
  if (opts.brand && opts.brand.trim().length > 0) {
    return opts.brand.trim();
  }
  const cleaned = opts.name
    .replace(/^\*[^*]+\*\s*/g, "") // strip leading *DNR* etc.
    .replace(/^[0-9]+\s*/, "")
    .trim();
  // Take first 2 words as a search seed.
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(" ");
}

/**
 * Look up an image on Wikipedia for the given brand/title query.
 * Returns null on any failure (we log but don't throw).
 */
export async function lookupWikipediaImage(
  query: string,
): Promise<WikipediaImage | null> {
  if (!query || query.length < 2) return null;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "400",
    redirects: "1",
    inprop: "url",
    titles: query,
    origin: "*",
  });

  try {
    const res = await fetch(`${WIKI_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Don't let a slow request hang a batch.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as WikiResponse;
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages).find((p) => !p.missing && p.thumbnail);
    if (!page || !page.thumbnail || !page.title) return null;

    return {
      title: page.title,
      thumbnailUrl: page.thumbnail.source,
      articleUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    };
  } catch {
    return null;
  }
}

/**
 * Version with simple in-memory caching for a single request, so a batch
 * doesn't hit Wikipedia 200 times for "Jack Daniel's".
 */
export function createWikipediaLookup() {
  const cache = new Map<string, WikipediaImage | null>();
  return async function lookup(query: string): Promise<WikipediaImage | null> {
    const key = query.toLowerCase();
    if (cache.has(key)) return cache.get(key) ?? null;
    const result = await lookupWikipediaImage(query);
    cache.set(key, result);
    return result;
  };
}
