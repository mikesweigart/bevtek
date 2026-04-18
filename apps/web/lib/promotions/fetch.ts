// Shared wrapper around the active_promotions_for_store() RPC. Used by
// the shop page (FeaturedRow), Gabby chat/assistant endpoints (for the
// sponsored-boost), and the owner /promotions dashboard.
//
// Keeping this in one place means the sponsored-boost logic in Gabby and
// the FTC "Sponsored" marker in the UI are always reading the same list.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivePromotion = {
  id: string;
  kind: "store" | "national";
  title: string;
  tagline: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  priority: number;
  inventory_id: string;
  inventory_name: string;
  inventory_price: number | null;
  inventory_image_url: string | null;
  inventory_stock_qty: number;
  inventory_brand: string | null;
  inventory_varietal: string | null;
  inventory_summary: string | null;
};

/**
 * Pull the active featured/sponsored products for a store. The RPC
 * already filters out stale/opted-out promos and resolves national
 * campaigns against this store's inventory (no in-stock match = no
 * show), so the caller can just render the list.
 */
export async function fetchActivePromotions(
  supabase: SupabaseClient,
  storeId: string,
): Promise<ActivePromotion[]> {
  const { data, error } = await supabase.rpc("active_promotions_for_store", {
    p_store_id: storeId,
  });
  if (error || !data) return [];
  return data as ActivePromotion[];
}
