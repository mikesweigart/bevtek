// Untappd — beer, cider, and hard seltzer. Industry-standard check-in
// network with real per-beer ratings, not just brewery averages. We hit
// the per-beer URL (/b/<slug>/<id>) which embeds an AggregateRating
// JSON-LD block; brewery landing pages don't, so siteSearch must surface
// a beer page specifically.

import type { ProductCore } from "../../types";
import { fetchReviewFromProvider, type ReviewFetchResult } from "./shared";

export async function lookupUntappd(
  core: ProductCore,
): Promise<ReviewFetchResult> {
  const q = buildQuery(core);
  if (!q) return { score: null, count: null, url: null };
  // Appending "beer" to the query nudges Google toward the /b/ beer page
  // rather than the /v/ venue page for pub-brewed products.
  return fetchReviewFromProvider({
    query: `${q} beer`,
    siteSearch: "untappd.com",
  });
}

function buildQuery(core: ProductCore): string | null {
  const parts: string[] = [];
  if (core.brand) parts.push(core.brand);
  if (core.varietal) parts.push(core.varietal);
  if (parts.length >= 1) return parts.join(" ").slice(0, 100);
  if (core.name) return core.name.trim().slice(0, 100);
  return null;
}
