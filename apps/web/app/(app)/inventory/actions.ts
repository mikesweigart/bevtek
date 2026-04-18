"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/utils/supabase/server";
import {
  detectMapping,
  mapRow,
  type InventoryRowInput,
} from "@/lib/inventory/columnMap";
import {
  createWikipediaLookup,
  extractBrandQuery,
} from "@/lib/images/wikipedia";
import {
  lookupOpenFoodFacts,
  isLikelyBarcode,
} from "@/lib/images/openFoodFacts";

export type PreviewState = {
  error: string | null;
  preview: {
    headers: string[];
    mapping: Record<string, string>;
    sample: InventoryRowInput[];
    total: number;
    skippedZeroStock: number;
    rowsB64: string; // base64-encoded JSON of all parsed rows, for the import step
  } | null;
};

export async function previewUploadAction(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file.", preview: null };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { error: "File too large (max 20 MB).", preview: null };
  }

  let rows: Record<string, unknown>[];
  let headers: string[];
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "Empty workbook.", preview: null };
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    // Reconstruct headers in sheet order.
    const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
    });
    headers = (json[0] ?? []).map((h) => String(h));
  } catch (e) {
    return {
      error: `Could not parse file: ${(e as Error).message}`,
      preview: null,
    };
  }

  if (rows.length === 0) {
    return { error: "File has no data rows.", preview: null };
  }

  const mapping = detectMapping(headers);
  if (!mapping.name) {
    return {
      error:
        "Couldn't find an item-name column. Expected a header like 'Name', 'Item Name', or 'Product Name'.",
      preview: null,
    };
  }

  // Parse every row, but drop anything with zero (or missing) on-hand stock.
  // A store's export often includes discontinued/out-of-stock SKUs we don't
  // want polluting recommendations or the shopper catalog.
  const parsed: InventoryRowInput[] = [];
  let skippedZeroStock = 0;
  for (const r of rows) {
    const m = mapRow(r, headers, mapping);
    if (!m) continue;
    if (!m.stock_qty || m.stock_qty <= 0) {
      skippedZeroStock++;
      continue;
    }
    parsed.push(m);
  }

  return {
    error: null,
    preview: {
      headers,
      mapping: mapping as Record<string, string>,
      sample: parsed.slice(0, 10),
      total: parsed.length,
      skippedZeroStock,
      rowsB64: Buffer.from(JSON.stringify(parsed)).toString("base64"),
    },
  };
}

export type ImportState = {
  error: string | null;
  inserted: number | null;
};

export async function commitImportAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const b64 = String(formData.get("rowsB64") ?? "");
  if (!b64) return { error: "Nothing to import.", inserted: null };

  let rows: InventoryRowInput[];
  try {
    rows = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  } catch {
    return { error: "Import payload corrupt.", inserted: null };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import.", inserted: null };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", inserted: null };

  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id;
  if (!storeId) return { error: "No store on profile.", inserted: null };

  // Attach store_id, strip empty sku so the unique constraint doesn't conflict.
  const payload = rows.map((r) => ({ ...r, store_id: storeId }));

  // Chunk to stay under request size limits.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("inventory")
      .upsert(slice, {
        onConflict: "store_id,sku",
        ignoreDuplicates: false,
        count: "exact",
      });
    if (error) return { error: error.message, inserted };
    inserted += count ?? slice.length;
  }

  revalidatePath("/inventory");
  return { error: null, inserted };
}

// ---------------------------------------------------------------------------
// Wikipedia image enrichment
// ---------------------------------------------------------------------------

export type EnrichState = {
  error: string | null;
  scanned: number | null;
  updated: number | null;
  bySource: { openfoodfacts: number; wikipedia: number } | null;
};

const MAX_ITEMS_PER_RUN = 200;
const SLEEP_MS_BETWEEN_LOOKUPS = 100;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function enrichImagesAction(
  _prev: EnrichState,
): Promise<EnrichState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "Not authenticated.", scanned: null, updated: null, bySource: null };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id) {
    return { error: "No store.", scanned: null, updated: null, bySource: null };
  }
  if (p.role !== "owner" && p.role !== "manager") {
    return {
      error: "Only owners or managers can enrich.",
      scanned: null,
      updated: null,
      bySource: null,
    };
  }

  // Pull items missing an image. SKU included so we can try barcode lookup.
  const { data: items } = (await supabase
    .from("inventory")
    .select("id, name, brand, sku")
    .eq("store_id", p.store_id)
    .eq("is_active", true)
    .is("image_url", null)
    .limit(MAX_ITEMS_PER_RUN)) as {
    data:
      | { id: string; name: string; brand: string | null; sku: string | null }[]
      | null;
  };

  if (!items || items.length === 0) {
    return {
      error: null,
      scanned: 0,
      updated: 0,
      bySource: { openfoodfacts: 0, wikipedia: 0 },
    };
  }

  const wikipediaLookup = createWikipediaLookup();
  const counters = { openfoodfacts: 0, wikipedia: 0 };

  for (const item of items) {
    let imageUrl: string | null = null;
    let source: "openfoodfacts" | "wikipedia" | null = null;

    // Tier 1: exact SKU lookup via Open Food Facts (if SKU looks like a barcode).
    if (isLikelyBarcode(item.sku)) {
      const off = await lookupOpenFoodFacts(item.sku!);
      if (off) {
        imageUrl = off.imageUrl;
        source = "openfoodfacts";
      }
      await sleep(SLEEP_MS_BETWEEN_LOOKUPS);
    }

    // Tier 2: brand-level image via Wikipedia.
    if (!imageUrl) {
      const q = extractBrandQuery({ brand: item.brand, name: item.name });
      if (q) {
        const wiki = await wikipediaLookup(q);
        if (wiki) {
          imageUrl = wiki.thumbnailUrl;
          source = "wikipedia";
        }
      }
      await sleep(SLEEP_MS_BETWEEN_LOOKUPS);
    }

    if (imageUrl && source) {
      const { error } = await supabase
        .from("inventory")
        .update({ image_url: imageUrl, image_source: source })
        .eq("id", item.id);
      if (!error) counters[source]++;
    }
  }

  revalidatePath("/inventory");
  return {
    error: null,
    scanned: items.length,
    updated: counters.openfoodfacts + counters.wikipedia,
    bySource: counters,
  };
}

// Keep the old name as an alias for the existing client import.
export const enrichImagesFromWikipediaAction = enrichImagesAction;

// ---------------------------------------------------------------------------
// Name normalization — CSV imports arrive as one mashed ALL-CAPS string.
// Before enrichment can find photos/notes/reviews, we parse those names
// into brand + varietal + size via Claude Haiku.
// ---------------------------------------------------------------------------

export type NormalizeState = {
  error: string | null;
  processed: number | null;
  remaining: number | null;
  /** How many rows got a non-null brand after this pass. */
  parsed: number | null;
};

// Haiku is fast — we can do more rows per invocation than the enrichment
// loop. 60 rows / ~4 Haiku calls comfortably fits under 60s.
const MAX_NORMALIZE_PER_RUN = 60;

export async function normalizeNamesAction(
  _prev: NormalizeState,
): Promise<NormalizeState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      error: "Not authenticated.",
      processed: null,
      remaining: null,
      parsed: null,
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id) {
    return {
      error: "No store.",
      processed: null,
      remaining: null,
      parsed: null,
    };
  }
  if (p.role !== "owner" && p.role !== "manager") {
    return {
      error: "Only owners or managers can normalize.",
      processed: null,
      remaining: null,
      parsed: null,
    };
  }

  // Candidates: rows still missing a brand. Idempotent by construction —
  // once brand is populated, the row drops out of future runs.
  const { data: items } = (await supabase
    .from("inventory")
    .select("id, name, category")
    .eq("store_id", p.store_id)
    .is("brand", null)
    .limit(MAX_NORMALIZE_PER_RUN)) as {
    data: Array<{ id: string; name: string; category: string | null }> | null;
  };

  if (!items || items.length === 0) {
    return { error: null, processed: 0, remaining: 0, parsed: 0 };
  }

  const { normalizeNames } = await import("@/lib/enrichment/normalizeNames");
  const results = await normalizeNames(items);

  // Write back per-row. We only update fields that came back non-null so
  // we never overwrite something the owner may have hand-edited.
  let parsed = 0;
  for (const r of results) {
    const patch: Record<string, unknown> = {};
    if (r.brand) patch.brand = r.brand;
    if (r.varietal) patch.varietal = r.varietal;
    if (r.size_label) patch.size_label = r.size_label;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await supabase
      .from("inventory")
      .update(patch)
      .eq("id", r.id);
    if (!error && r.brand) parsed++;
  }

  const { count: remaining } = await supabase
    .from("inventory")
    .select("id", { count: "exact", head: true })
    .eq("store_id", p.store_id)
    .is("brand", null);

  revalidatePath("/inventory");

  return {
    error: null,
    processed: items.length,
    remaining: remaining ?? 0,
    parsed,
  };
}

// ---------------------------------------------------------------------------
// Full enrichment — image + tasting notes + confidence scoring.
// Uses the new lib/enrichment pipeline (Open Food Facts → Claude fallback).
// Processes up to MAX_FULL_ENRICH_PER_RUN unenriched rows per click so a
// single long request doesn't time out on Vercel's 60s hobby cap.
// ---------------------------------------------------------------------------

export type FullEnrichState = {
  error: string | null;
  processed: number | null;
  byConfidence: {
    verified: number;
    high: number;
    medium: number;
    low: number;
    partial: number;
    none: number;
  } | null;
  remaining: number | null;
};

// 10 per invocation keeps us under the serverless timeout even when
// every row hits the Claude fallback (~3–5s each). The client loops
// this action back-to-back to process larger catalogs.
const MAX_FULL_ENRICH_PER_RUN = 10;

export async function enrichFullAction(
  _prev: FullEnrichState,
): Promise<FullEnrichState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return {
      error: "Not authenticated.",
      processed: null,
      byConfidence: null,
      remaining: null,
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id) {
    return {
      error: "No store.",
      processed: null,
      byConfidence: null,
      remaining: null,
    };
  }
  if (p.role !== "owner" && p.role !== "manager") {
    return {
      error: "Only owners or managers can enrich.",
      processed: null,
      byConfidence: null,
      remaining: null,
    };
  }

  // Pull unenriched rows. enriched_at is null when the pipeline hasn't
  // touched them yet. Re-runs pick up where the last click left off.
  const { data: items } = (await supabase
    .from("inventory")
    .select(
      "id, store_id, name, brand, category, varietal, upc, size_label",
    )
    .eq("store_id", p.store_id)
    .is("enriched_at", null)
    .limit(MAX_FULL_ENRICH_PER_RUN)) as {
    data:
      | Array<{
          id: string;
          store_id: string;
          name: string;
          brand: string | null;
          category: string | null;
          varietal: string | null;
          upc: string | null;
          size_label: string | null;
        }>
      | null;
  };

  if (!items || items.length === 0) {
    return {
      error: null,
      processed: 0,
      byConfidence: {
        verified: 0,
        high: 0,
        medium: 0,
        low: 0,
        partial: 0,
        none: 0,
      },
      remaining: 0,
    };
  }

  // Lazy import so this file stays tree-shakeable for server actions that
  // don't need enrichment.
  const { enrichProduct } = await import("@/lib/enrichment/enrichProduct");

  const tallies = {
    verified: 0,
    high: 0,
    medium: 0,
    low: 0,
    partial: 0,
    none: 0,
  };

  // Per-item throttle — Open Food Facts is a free community service.
  // 600ms between items keeps us at <2 req/s to their API even when
  // we're running both UPC + name-search passes. Takes ~6s/batch of 10
  // on top of actual processing time, still well within the 60s budget.
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await sleep(600);
    const outcome = await enrichProduct(supabase, items[i]);
    tallies[outcome.confidence]++;
  }

  // How many still left after this pass? Useful for the "Run again" nudge.
  const { count: remaining } = await supabase
    .from("inventory")
    .select("id", { count: "exact", head: true })
    .eq("store_id", p.store_id)
    .is("enriched_at", null);

  revalidatePath("/inventory");

  return {
    error: null,
    processed: items.length,
    byConfidence: tallies,
    remaining: remaining ?? 0,
  };
}

/**
 * Re-run the full enrichment pipeline for a single product — used from
 * the item detail page when an owner wants to retry a low-confidence row
 * (or one that came back with the "image coming soon" placeholder).
 *
 * Server action bound to a form; reads `id` from formData. Resets
 * enriched_at + image_url=null first so the pipeline writes fresh
 * values instead of being guarded by the "only write when null" merge.
 */
export async function reenrichSingleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id) return;
  if (p.role !== "owner" && p.role !== "manager") return;

  // Only fields the merge-partial accumulator treats as "empty" get
  // re-filled. Wipe the image, notes, and source-confidence markers so
  // the pipeline runs as if this row had never been touched. Manual
  // image_source='manual' rows skip this path — an owner chose that
  // image on purpose, don't clobber it.
  const { data: existing } = await supabase
    .from("inventory")
    .select("id, store_id, name, brand, category, varietal, upc, size_label, image_source")
    .eq("id", id)
    .maybeSingle();
  const row = existing as
    | {
        id: string;
        store_id: string;
        name: string;
        brand: string | null;
        category: string | null;
        varietal: string | null;
        upc: string | null;
        size_label: string | null;
        image_source: string | null;
      }
    | null;
  if (!row) return;
  if (row.store_id !== p.store_id) return;

  const wipe: Record<string, unknown> = {
    tasting_notes: null,
    summary_for_customer: null,
    source_confidence: null,
    enriched_at: null,
  };
  // Preserve a manually-set image; otherwise clear it so the pipeline
  // can try again (placeholder / low-confidence rows get a fresh shot).
  if (row.image_source !== "manual") {
    wipe.image_url = null;
  }
  await supabase.from("inventory").update(wipe).eq("id", id);

  const { enrichProduct } = await import("@/lib/enrichment/enrichProduct");
  await enrichProduct(supabase, row);

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
}
