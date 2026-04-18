// Distiller — whiskey, tequila, rum, gin, liqueurs. Community ratings on
// a 0–100 scale plus expert tasting notes; well-structured pages with
// AggregateRating JSON-LD. Their scores run 0–100, so we normalize to
// the same 0–5 scale as Vivino/Untappd before storing, so Gabby can say
// "4.3 stars" consistently regardless of source.

import type { ProductCore } from "../../types";
import { fetchReviewFromProvider, type ReviewFetchResult } from "./shared";

export async function lookupDistiller(
  core: ProductCore,
): Promise<ReviewFetchResult> {
  const q = buildQuery(core);
  if (!q) return { score: null, count: null, url: null };

  const raw = await fetchReviewFromProvider({
    query: q,
    siteSearch: "distiller.com",
  });
  if (raw.score == null) return raw;

  // Distiller publishes its community rating on a 1–5 scale already in
  // AggregateRating (the 0–100 number is a separate "expert rating"),
  // but some pages mistakenly put the 0–100 number in ratingValue. If
  // we see something > 10, assume it's the 0–100 and rescale.
  const score = raw.score > 10 ? raw.score / 20 : raw.score;
  return { ...raw, score };
}

function buildQuery(core: ProductCore): string | null {
  const parts: string[] = [];
  if (core.brand) parts.push(core.brand);
  if (core.varietal) parts.push(core.varietal);
  if (parts.length >= 1) return parts.join(" ").slice(0, 100);
  if (core.name) return core.name.trim().slice(0, 100);
  return null;
}
