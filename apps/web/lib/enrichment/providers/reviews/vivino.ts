// Vivino — wine. Community ratings at 50M+ user scale, the de facto
// consumer signal for wine. Wine pages embed a clean AggregateRating
// JSON-LD block for SEO; we read it out and cite the URL so Gabby can
// deep-link ("read 1,843 reviews on Vivino →").

import type { ProductCore } from "../../types";
import { fetchReviewFromProvider, type ReviewFetchResult } from "./shared";

export async function lookupVivino(
  core: ProductCore,
): Promise<ReviewFetchResult> {
  const q = buildQuery(core);
  if (!q) return { score: null, count: null, url: null };
  return fetchReviewFromProvider({ query: q, siteSearch: "vivino.com" });
}

function buildQuery(core: ProductCore): string | null {
  // For wine, brand-less rows are common in importers' raw CSVs
  // ("SUTTER HOME PINOT GRIGIO 1.5 L"); Step 1 normalization should have
  // already split that into brand + varietal, so both fields are usually
  // populated. If not, fall back to the name.
  const parts: string[] = [];
  if (core.brand) parts.push(core.brand);
  if (core.varietal) parts.push(core.varietal);
  if (parts.length >= 2) return parts.join(" ").slice(0, 100);

  if (core.name) return core.name.trim().slice(0, 100);
  return null;
}
