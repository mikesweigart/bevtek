"use server";

// Store-kind promotion actions. Store owners/managers use these to feature
// their own products on the shop page. National-kind promos live in a
// separate admin namespace and aren't writable from here.

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type FeatureProductState = { error: string | null; id: string | null };

async function getContext() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, storeId: null, userId: null, role: null };
  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  return {
    supabase,
    storeId: p?.store_id ?? null,
    userId: auth.user.id,
    role: p?.role ?? null,
  };
}

/**
 * Feature one of our own products. Creates a store-kind promotion that
 * runs from now() until end_date (default +14 days). Idempotent-ish: if
 * this product is already featured in an active window, extends that
 * instead of creating a duplicate.
 */
export async function featureProductAction(
  _prev: FeatureProductState,
  formData: FormData,
): Promise<FeatureProductState> {
  const inventoryId = String(formData.get("inventory_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const daysStr = String(formData.get("days") ?? "14").trim();
  const days = Math.max(1, Math.min(90, parseInt(daysStr, 10) || 14));

  if (!inventoryId) return { error: "Missing product.", id: null };
  if (!title) return { error: "Title is required.", id: null };

  const { supabase, storeId, userId, role } = await getContext();
  if (!storeId || !userId) {
    return { error: "Not authenticated.", id: null };
  }
  if (role !== "owner" && role !== "manager") {
    return {
      error: "Only owners or managers can feature products.",
      id: null,
    };
  }

  // Confirm the product belongs to this store — RLS already enforces,
  // but fail early with a clean error.
  const { data: inv } = await supabase
    .from("inventory")
    .select("id, store_id")
    .eq("id", inventoryId)
    .maybeSingle();
  const invRow = inv as { id: string; store_id: string } | null;
  if (!invRow || invRow.store_id !== storeId) {
    return { error: "Product not found in your store.", id: null };
  }

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + days);

  // Extend an existing active promo for the same product, if any, rather
  // than creating duplicates.
  const { data: existing } = await supabase
    .from("promotions")
    .select("id")
    .eq("store_id", storeId)
    .eq("kind", "store")
    .eq("inventory_id", inventoryId)
    .eq("status", "active")
    .gte("ends_at", new Date().toISOString())
    .maybeSingle();

  const existingRow = existing as { id: string } | null;
  if (existingRow) {
    const { error } = await supabase
      .from("promotions")
      .update({
        title,
        tagline,
        ends_at: endsAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingRow.id);
    if (error) return { error: error.message, id: null };
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${inventoryId}`);
    revalidatePath("/promotions");
    return { error: null, id: existingRow.id };
  }

  const { data, error } = await supabase
    .from("promotions")
    .insert({
      kind: "store",
      store_id: storeId,
      created_by: userId,
      title,
      tagline,
      inventory_id: inventoryId,
      starts_at: new Date().toISOString(),
      ends_at: endsAt.toISOString(),
      status: "active",
    })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };
  const created = data as { id: string };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${inventoryId}`);
  revalidatePath("/promotions");
  return { error: null, id: created.id };
}

/**
 * End a featured promo early (form-bound — no prev state). Only affects
 * this store's own store-kind promos; national promos need an opt-out
 * via the separate opt-out action.
 */
export async function endPromotionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const { supabase, storeId, role } = await getContext();
  if (!storeId) return;
  if (role !== "owner" && role !== "manager") return;

  await supabase
    .from("promotions")
    .update({
      status: "ended",
      ends_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("store_id", storeId)
    .eq("kind", "store");

  revalidatePath("/inventory");
  revalidatePath("/promotions");
}

/**
 * Opt this store out of a specific national promo. The shop page's
 * active_promotions_for_store() RPC will then skip it for this store
 * even while it's still active for others.
 */
export async function optOutOfNationalPromoAction(
  formData: FormData,
): Promise<void> {
  const promotionId = String(formData.get("promotion_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!promotionId) return;
  const { supabase, storeId, userId, role } = await getContext();
  if (!storeId || !userId) return;
  if (role !== "owner" && role !== "manager") return;

  await supabase.from("promotion_opt_outs").upsert(
    {
      promotion_id: promotionId,
      store_id: storeId,
      opted_out_by: userId,
      reason,
    },
    { onConflict: "promotion_id,store_id" },
  );

  revalidatePath("/promotions");
}
