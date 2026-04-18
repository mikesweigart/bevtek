// POST /api/inventory/enrich
//
// Enriches a single inventory row — intended for smoke-testing the
// pipeline from the browser DevTools console or a curl command.
// Production callers go through the batch import endpoint (shipping
// next). This one is the "does my wiring work?" button.
//
// Body: { item_id: string }   OR   { store_id: string, limit: number }
//   - Single item: enrich that one row by id.
//   - Batch: enrich up to `limit` unenriched rows in the given store.
//
// Auth: owner/manager of the store. RLS on inventory already restricts
// which rows the user can see; we defer to it rather than re-checking
// here.

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enrichProduct } from "@/lib/enrichment/enrichProduct";
import type { ProductCore } from "@/lib/enrichment/types";

export const runtime = "nodejs";
// Enrichment does real network IO (OFF + Claude), so give it room.
export const maxDuration = 60;

type Body =
  | { item_id: string }
  | { store_id: string; limit?: number };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Resolve target rows.
  const query = supabase
    .from("inventory")
    .select("id, store_id, name, brand, category, upc, size_label");

  let cores: ProductCore[];
  if ("item_id" in body) {
    const { data, error } = await query.eq("id", body.item_id).maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    cores = [data as ProductCore];
  } else {
    const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);
    const { data, error } = await query
      .eq("store_id", body.store_id)
      .is("enriched_at", null)
      .limit(limit);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    cores = (data ?? []) as ProductCore[];
  }

  // Run sequentially. Parallelizing here would starve OFF/Claude
  // rate limits — the batch endpoint will handle fan-out properly.
  const results = [];
  for (const core of cores) {
    const outcome = await enrichProduct(supabase, core);
    results.push(outcome);
  }

  return NextResponse.json({
    count: results.length,
    results,
  });
}
