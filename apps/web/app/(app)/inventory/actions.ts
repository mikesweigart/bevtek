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

export type PreviewState = {
  error: string | null;
  preview: {
    headers: string[];
    mapping: Record<string, string>;
    sample: InventoryRowInput[];
    total: number;
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

  const parsed: InventoryRowInput[] = [];
  for (const r of rows) {
    const m = mapRow(r, headers, mapping);
    if (m) parsed.push(m);
  }

  return {
    error: null,
    preview: {
      headers,
      mapping: mapping as Record<string, string>,
      sample: parsed.slice(0, 10),
      total: parsed.length,
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
};

const MAX_ITEMS_PER_RUN = 200; // keep a single request short
const SLEEP_MS_BETWEEN_LOOKUPS = 100; // gentle on Wikipedia

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function enrichImagesFromWikipediaAction(
  _prev: EnrichState,
): Promise<EnrichState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "Not authenticated.", scanned: null, updated: null };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id) {
    return { error: "No store.", scanned: null, updated: null };
  }
  if (p.role !== "owner" && p.role !== "manager") {
    return { error: "Only owners or managers can enrich.", scanned: null, updated: null };
  }

  // Pull items missing an image.
  const { data: items } = (await supabase
    .from("inventory")
    .select("id, name, brand")
    .eq("store_id", p.store_id)
    .eq("is_active", true)
    .is("image_url", null)
    .limit(MAX_ITEMS_PER_RUN)) as {
    data: { id: string; name: string; brand: string | null }[] | null;
  };

  if (!items || items.length === 0) {
    return { error: null, scanned: 0, updated: 0 };
  }

  const lookup = createWikipediaLookup();
  let updated = 0;

  for (const item of items) {
    const q = extractBrandQuery({ brand: item.brand, name: item.name });
    if (!q) continue;
    const hit = await lookup(q);
    if (hit) {
      const { error } = await supabase
        .from("inventory")
        .update({ image_url: hit.thumbnailUrl, image_source: "wikipedia" })
        .eq("id", item.id);
      if (!error) updated++;
    }
    await sleep(SLEEP_MS_BETWEEN_LOOKUPS);
  }

  revalidatePath("/inventory");
  return { error: null, scanned: items.length, updated };
}
