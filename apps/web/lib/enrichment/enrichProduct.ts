// Enrichment orchestrator — runs the three-pass pipeline for one product.
//
// Pass 1: Image
//   a. Shared UPC cache (cross-store hit → instant)
//   b. Open Food Facts by UPC
//   (later) c. Producer-site scrape, d. fuzzy name match
//
// Pass 2: Tasting notes
//   a. External description from pass 1 (if long enough, use verbatim)
//   b. LLM generation grounded on name + brand + category
//
// Pass 3: Reviews (not yet — stubbed null, pluggable later)
//
// The final EnrichmentResult is scored into a source_confidence tier
// and written back to public.inventory. We always write — even "none" —
// so enriched_at reflects the attempt, not just successes.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyResult,
  mergePartial,
  type EnrichmentResult,
  type ProductCore,
} from "./types";
import { scoreConfidence } from "./confidence";
import { lookupByUpc, searchByName } from "./providers/upcLookup";
import { getCachedImage, setCachedImage } from "./providers/imageCache";
import { getTastingNotes } from "./providers/tastingNotes";
import { lookupWikipedia } from "./providers/wikipediaLookup";
import { lookupProducerSite } from "./providers/producerSite";
import { lookupRetailSite } from "./providers/retailLookup";
import { lookupGoogleSearch } from "./providers/googleSearch";
import { getReviews } from "./providers/reviews";

/** Bumped whenever the pipeline changes — drives the backfill rerun gate. */
export const ENRICHMENT_VERSION = 5;

/** Public URL of the "image coming soon" fallback served from /public. */
const PLACEHOLDER_IMAGE_URL = "/bottle-coming-soon.svg";

export type EnrichOutcome = {
  product_id: string;
  confidence: ReturnType<typeof scoreConfidence>;
  wrote: Partial<Record<keyof EnrichmentResult, boolean>>;
};

/**
 * Enrich one product. Pure with respect to inputs; persistence is handled
 * at the end via the passed-in supabase client.
 *
 * Safe to call on an already-enriched row — each field only writes if
 * it's still missing (merged-partial semantics).
 */
export async function enrichProduct(
  supabase: SupabaseClient,
  core: ProductCore,
): Promise<EnrichOutcome> {
  let acc = emptyResult();

  // ---------- Pass 1: image ----------
  const cached = await getCachedImage(supabase, core.upc);
  if (cached) {
    acc = mergePartial(acc, {
      image_url: cached.image_url,
      image_source: "cache",
    });
  }

  // External description is reused by pass 2, so we capture it here
  // even when the image came from cache. Track where it came from so
  // tasting_notes_source reflects the real provenance, not a guess.
  let externalDesc: string | null = null;
  let externalDescSource:
    | "open_food_facts"
    | "producer_site"
    | "retail_site"
    | null = null;

  if (!acc.image_url || !externalDesc) {
    // Pass 1a: UPC lookup (fastest, most reliable when UPC is present).
    const off = await lookupByUpc(core);
    if (off.description) {
      externalDesc = off.description;
      externalDescSource = "open_food_facts";
    }

    if (!acc.image_url && off.image_url) {
      acc = mergePartial(acc, {
        image_url: off.image_url,
        image_source: "open_food_facts",
      });
      // Seed the shared cache for the next store that uploads this UPC.
      if (core.upc) {
        await setCachedImage(
          supabase,
          core.upc,
          off.image_url,
          "open_food_facts",
        );
      }
    }
  }

  // Pass 1b: name + brand search — catches rows without UPCs and rows
  // whose UPC isn't in OFF. Runs only when pass 1a didn't find an image,
  // so UPC-equipped catalogs skip this entirely.
  if (!acc.image_url) {
    const byName = await searchByName(core);
    if (byName.image_url) {
      acc = mergePartial(acc, {
        image_url: byName.image_url,
        image_source: "open_food_facts",
      });
    }
    // Opportunistically capture a description if pass 1a missed one too.
    if (!externalDesc && byName.description) {
      externalDesc = byName.description;
      externalDescSource = "open_food_facts";
    }
  }

  // Pass 1c: Wikipedia. Most well-known consumer brands (Tito's, Sierra
  // Nevada, Maker's Mark, Dom Pérignon) have articles with a logo or
  // bottle image on upload.wikimedia.org — CC-BY-SA, safe to rehost.
  if (!acc.image_url) {
    const wiki = await lookupWikipedia(core);
    if (wiki.image_url) {
      acc = mergePartial(acc, {
        image_url: wiki.image_url,
        image_source: "wikipedia",
      });
    }
  }

  // Pass 1d: Producer homepage og:image. Guesses domains from the brand
  // name (titos.com, drinktitos.com, silveroakwinery.com, …) and pulls
  // the Open Graph image/description from the first 200. This is the
  // same image every social platform pulls when the brand URL is shared.
  if (!acc.image_url) {
    const prod = await lookupProducerSite(core);
    if (prod.image_url) {
      acc = mergePartial(acc, {
        image_url: prod.image_url,
        image_source: "producer_site",
      });
    }
    if (!externalDesc && prod.description) {
      externalDesc = prod.description;
      externalDescSource = "producer_site";
    }
  }

  // Pass 1e: Google Custom Search, scoped to trusted beverage retailers
  // (Total Wine, ReserveBar, Wine.com, Drizly, Binny's, K&L, Seelbach's,
  // Caskers). This is the reliable long-tail path — Google's crawlers
  // have a pass on Cloudflare where our direct fetches don't, and the
  // API response embeds og:image from Google's page cache so we often
  // skip the product-page fetch entirely. Requires GOOGLE_API_KEY +
  // GOOGLE_CSE_ID env vars; silent no-op if unset.
  if (!acc.image_url || !externalDesc) {
    const google = await lookupGoogleSearch(core);
    if (!acc.image_url && google.image_url) {
      acc = mergePartial(acc, {
        image_url: google.image_url,
        image_source: "retail_site",
      });
    }
    if (!externalDesc && google.description) {
      externalDesc = google.description;
      externalDescSource = "retail_site";
    }
  }

  // Pass 1f: Direct retailer scrape — last-ditch fallback when Google
  // didn't return a usable result. Often whiffs on Cloudflare, but free
  // and occasionally catches rows Google ranks below our cutoff.
  if (!acc.image_url || !externalDesc) {
    const retail = await lookupRetailSite(core);
    if (!acc.image_url && retail.image_url) {
      acc = mergePartial(acc, {
        image_url: retail.image_url,
        image_source: "retail_site",
      });
    }
    if (!externalDesc && retail.description) {
      externalDesc = retail.description;
      externalDescSource = "retail_site";
    }
  }

  // Pass 1f: Placeholder. Every shopper-facing row must have *something*
  // to render — a broken or missing image looks worse than an honest
  // "coming soon" card. image_source = "placeholder" so we can later
  // filter for retry-ready rows.
  if (!acc.image_url) {
    acc = mergePartial(acc, {
      image_url: PLACEHOLDER_IMAGE_URL,
      image_source: "placeholder",
    });
  }

  // ---------- Pass 2: tasting notes ----------
  const notes = await getTastingNotes(core, externalDesc);
  if (notes.tasting_notes) {
    // When Haiku distilled real source material, we surface the ORIGINAL
    // provider as the source (retail_site / producer_site / OFF). Only
    // pure generations get flagged "generated" so confidence scoring can
    // de-boost them vs. distillations of real producer copy.
    const notesSource = notes.generated
      ? "generated"
      : externalDescSource ?? "open_food_facts";
    acc = mergePartial(acc, {
      tasting_notes: notes.tasting_notes,
      tasting_notes_source: notesSource,
      summary_for_customer: notes.summary_for_customer,
    });
  }

  // ---------- Pass 3: reviews ----------
  // Category-routed lookup against Vivino (wine), Untappd (beer/cider),
  // or Distiller (spirits). Silent no-op for RTDs/mixers/non-alc (no
  // consensus review source). Uses the shared Google CSE key — one
  // lookup per row, capped at ~$0.005 each. Failure modes all return
  // nulls, so the rest of the row writes cleanly even when reviews
  // whiff (which they will for long-tail/private-label SKUs).
  const reviews = await getReviews(core);
  if (reviews.score != null) {
    acc = mergePartial(acc, {
      review_score: reviews.score,
      review_count: reviews.count,
      review_source: reviews.source,
      review_url: reviews.url,
    });
  }

  // ---------- Persist ----------
  const confidence = scoreConfidence(acc);
  const patch: Record<string, unknown> = {
    image_url: acc.image_url,
    tasting_notes: acc.tasting_notes,
    summary_for_customer: acc.summary_for_customer,
    review_score: acc.review_score,
    review_count: acc.review_count,
    review_source: acc.review_source,
    review_url: acc.review_url,
    source_confidence: confidence,
    enriched_at: new Date().toISOString(),
    enrichment_version: ENRICHMENT_VERSION,
  };

  // metadata.* goes in the jsonb bucket so we don't inflate the column
  // count with audit fields.
  const meta = {
    image_source: acc.image_source,
    tasting_notes_source: acc.tasting_notes_source,
    review_source: acc.review_source,
  };

  const { error } = await supabase
    .from("inventory")
    .update({
      ...patch,
      // Merge into existing metadata without clobbering other keys.
      metadata: supabaseJsonbMerge(meta),
    })
    .eq("id", core.id);

  // If the update failed (likely bad RLS / missing column), still return
  // the computed confidence so the caller can log it.
  const wrote: EnrichOutcome["wrote"] = error
    ? {}
    : {
        image_url: !!acc.image_url,
        tasting_notes: !!acc.tasting_notes,
        summary_for_customer: !!acc.summary_for_customer,
      };

  return { product_id: core.id, confidence, wrote };
}

/**
 * Postgres `metadata || '{...}'::jsonb` in JS form. Supabase JS doesn't
 * expose a direct ||-style update, so we read-modify-write via a
 * sub-select expression string. Simpler: use an RPC if this becomes hot.
 * For now, the caller merges client-side — this helper returns the raw
 * JSON so the caller wraps it in `metadata: <our helper output>`.
 *
 * NOTE: this still overwrites other metadata keys. If your rows rely on
 * metadata for other purposes, move to a dedicated RPC that does a true
 * jsonb concat. The current BevTek schema only uses metadata as a
 * free-form audit bucket, so overwrite is acceptable for v1.
 */
function supabaseJsonbMerge(obj: Record<string, unknown>): Record<string, unknown> {
  return obj;
}
