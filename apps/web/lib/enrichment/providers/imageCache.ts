// Shared image cache keyed on UPC — cross-store.
//
// First time a UPC is enriched, we fetch it from OFF (or wherever),
// rehost to Supabase Storage, and write the rehosted URL into
// public.product_image_cache. Every subsequent store that uploads the
// same UPC hits the cache and gets an instant, already-hosted image.
//
// Lookups use anon/service role via the caller's Supabase client so RLS
// still applies — owners reading their own inventory can see the
// cache, but writes happen via service role server-side only.

import type { SupabaseClient } from "@supabase/supabase-js";

export type CachedImage = {
  image_url: string;
  source: string;
};

export async function getCachedImage(
  supabase: SupabaseClient,
  upc: string | null,
): Promise<CachedImage | null> {
  if (!upc) return null;
  const { data } = await supabase
    .from("product_image_cache")
    .select("image_url, source")
    .eq("upc", upc)
    .maybeSingle();
  return (data as CachedImage | null) ?? null;
}

export async function setCachedImage(
  supabase: SupabaseClient,
  upc: string,
  image_url: string,
  source: string,
): Promise<void> {
  // Upsert — another worker may have cached this concurrently, that's fine.
  await supabase
    .from("product_image_cache")
    .upsert(
      { upc, image_url, source, fetched_at: new Date().toISOString() },
      { onConflict: "upc" },
    );
}
