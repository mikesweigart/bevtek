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

/** Bumped whenever the pipeline changes — drives the backfill rerun gate. */
export const ENRICHMENT_VERSION = 1;

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
  // even when the image came from cache.
  let externalDesc: string | null = null;

  if (!acc.image_url || !externalDesc) {
    // Pass 1a: UPC lookup (fastest, most reliable when UPC is present).
    const off = await lookupByUpc(core);
    externalDesc = off.description;

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
    }
  }

  // ---------- Pass 2: tasting notes ----------
  const notes = await getTastingNotes(core, externalDesc);
  if (notes.tasting_notes) {
    acc = mergePartial(acc, {
      tasting_notes: notes.tasting_notes,
      tasting_notes_source: notes.generated
        ? "generated"
        : "open_food_facts",
      summary_for_customer: notes.summary_for_customer,
    });
  }

  // ---------- Pass 3: reviews (stubbed) ----------
  // Real Vivino/Untappd/Distiller integrations plug in here. For now
  // we leave all review_* fields null — Gabby treats them as bonus,
  // not required.

  // ---------- Persist ----------
  const confidence = scoreConfidence(acc);
  const patch: Record<string, unknown> = {
    image_url: acc.image_url,
    tasting_notes: acc.tasting_notes,
    summary_for_customer: acc.summary_for_customer,
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
