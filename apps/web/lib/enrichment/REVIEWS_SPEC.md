# Reviews — Pass 3 integration spec

Status: **not yet built** — Pass 3 fields are stubbed null in `enrichProduct.ts`.
This doc is the design we'll build against. Nothing here ships without a PR.

## Goal

Put a "real shoppers rated this N★ (K reviews)" line under every bottle so Gabby
can say "Customers on Vivino average 4.2 on this one" instead of generic style
talk. Review scores are the single strongest trust signal we can add short of
staff tasting notes.

## The three sources — by category

| Category              | Primary source | Fallback           | Why                                                              |
| --------------------- | -------------- | ------------------ | ---------------------------------------------------------------- |
| Wine                  | Vivino         | Wine.com CSE hit   | Vivino has community-scale wine data, 50M+ users                |
| Beer / cider / seltzer| Untappd        | BeerAdvocate CSE   | Untappd is the category standard for craft beer ratings         |
| Spirits               | Distiller      | Total Wine CSE     | Distiller covers bourbon/scotch/tequila/gin well                |
| Everything else       | (skip)         | —                  | RTDs / canned cocktails don't have a consensus review source yet |

Category is already populated on every row. Route to provider on that field.

## Data shape

Add columns to `inventory` (one migration):

```sql
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS review_score numeric(3,2),  -- 4.23
  ADD COLUMN IF NOT EXISTS review_count integer,       -- 1843
  ADD COLUMN IF NOT EXISTS review_source text,         -- 'vivino' | 'untappd' | 'distiller'
  ADD COLUMN IF NOT EXISTS review_url text;            -- deep-link for "read all N reviews"
```

Store `review_source` as a stable enum-ish string so we can badge the origin
the same way we do for `image_source` today.

## Fetch strategy — same shape as Pass 1

None of these sites have a free public API we can hit at 6,291-row backfill
scale. **Google Custom Search is still the answer** — we already pay for and
trust it for images. Reuse `lookupGoogleSearch()` with the provider domain
locked in `siteSearch` (CSE param), then extract rating/count from the result
page.

Pattern per provider:

1. **Search** `"<brand> <varietal> vivino.com"` via CSE with `siteSearch=vivino.com`.
2. **Fetch** the first result's URL server-side.
3. **Parse** the JSON-LD `AggregateRating` node (all three sites embed it for SEO):
   ```json
   { "@type": "AggregateRating", "ratingValue": "4.2", "reviewCount": "1843" }
   ```
   If absent, fall back to og:description regex (`(\d+\.\d+)\s*out of\s*5`).
4. **Cap the body fetch** at 200 KB, 8s timeout. Same Cloudflare-risk profile
   as retail scrapers; silent skip on failure.

Provider file pattern (mirror `providers/googleSearch.ts`):

```
lib/enrichment/providers/reviews/
  vivino.ts
  untappd.ts
  distiller.ts
  index.ts    // category-routing entrypoint
```

Entrypoint signature:

```ts
export async function getReviews(core: ProductCore): Promise<{
  score: number | null;
  count: number | null;
  source: 'vivino' | 'untappd' | 'distiller' | null;
  url: string | null;
}>;
```

## Wiring into the pipeline

In `enrichProduct.ts`, after Pass 2:

```ts
// ---------- Pass 3: reviews ----------
const reviews = await getReviews(core);
if (reviews.score != null) {
  acc = mergePartial(acc, {
    review_score: reviews.score,
    review_count: reviews.count,
    review_source: reviews.source,
    review_url: reviews.url,
  });
}
```

Add the fields to `EnrichmentResult` in `types.ts`. Bump `ENRICHMENT_VERSION`
to 5 so the backfill gate re-runs rows already processed.

## Gabby wiring

Extend `InventoryForAI` in `lib/ai/claude.ts`:

```ts
review_score?: number | null;
review_count?: number | null;
```

Add one line to `formatInventoryBlock()`:

```ts
if (i.review_score) line += `  (★${i.review_score.toFixed(1)}, ${i.review_count} reviews)`;
```

And one bullet in each system prompt: "When a product has a review score, cite
it briefly — 'this one's 4.3 stars on Vivino' — it's a trust cue."

## Confidence scoring

In `lib/enrichment/confidence.ts`: a product with review_score populated bumps
one tier (medium → high, high → verified). Real community ratings are stronger
ground-truth than any scraped image or distilled description.

## Cost

Each Pass 3 call is one CSE query (~$0.005 at standard $5/1K) + one HTML fetch.
6,291 rows × ~60% category coverage ≈ 3,800 lookups ≈ **$19** for a full
backfill. Sub-batch to 200 rows/day to stay under the free tier if needed.

## Ethics / ToS

Vivino, Untappd, and Distiller all expose AggregateRating via JSON-LD
specifically so search engines can surface it — same use we're making. We
always deep-link the source (`review_url`) so users can read the full reviews
on the original site. No full review-text scraping in v1; score + count +
link only. Revisit if we decide to show review excerpts.

## Open questions for v2

- RTD category: is there any consensus source? (Probably not — leave null.)
- Do we want a staff-review override (an owner marks "our top pick")? Yes,
  but that's a separate `staff_pick boolean` column, not the review pipeline.
- Caching: should `review_score` be shared across stores like image_cache?
  Yes — same UPC/brand+varietal combo has the same score everywhere. Build
  a `review_cache` table keyed on UPC (fallback: lowercased brand+varietal
  hash).
