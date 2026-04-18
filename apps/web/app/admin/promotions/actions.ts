"use server";

// National-kind promotion CRUD. Only BevTek admins (email allow-list in
// BEVTEK_ADMIN_EMAILS env) can call these — they write across every
// store, so we deliberately skip Supabase RLS by using the service role
// client. Store-kind promos are the owner-facing counterpart in
// app/(app)/promotions/actions.ts.

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isBevTekAdmin } from "@/lib/auth/isAdmin";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function gate(): Promise<{ ok: boolean; email: string | null }> {
  const supabase = await createServerClient();
  return isBevTekAdmin(supabase);
}

export type CreateNationalState = {
  error: string | null;
  id: string | null;
};

/**
 * Create a national campaign. Matches against every store's inventory
 * via UPC / brand / category — whichever the admin provides. The
 * storefront RPC (active_promotions_for_store) resolves the match at
 * read time, so we don't need to pre-compute target rows here.
 */
export async function createNationalPromotionAction(
  _prev: CreateNationalState,
  formData: FormData,
): Promise<CreateNationalState> {
  const { ok } = await gate();
  if (!ok) return { error: "Not authorized.", id: null };

  const title = String(formData.get("title") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const upc = String(formData.get("upc") ?? "").trim() || null;
  const daysStr = String(formData.get("days") ?? "30").trim();
  const days = Math.max(1, Math.min(365, parseInt(daysStr, 10) || 30));
  const revenueSharePct = Math.max(
    0,
    Math.min(
      100,
      parseInt(String(formData.get("store_revenue_share_pct") ?? "10"), 10) ||
        10,
    ),
  );
  const priority = Math.max(
    0,
    Math.min(
      1000,
      parseInt(String(formData.get("priority") ?? "100"), 10) || 100,
    ),
  );

  if (!title) return { error: "Title is required.", id: null };
  if (!brand && !category && !upc) {
    return {
      error: "Must specify at least one of: brand, category, or UPC.",
      id: null,
    };
  }

  const service = getServiceClient();
  if (!service) {
    return { error: "Service role not configured on server.", id: null };
  }

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + days);

  const { data, error } = await service
    .from("promotions")
    .insert({
      kind: "national",
      title,
      tagline,
      brand,
      category,
      upc,
      starts_at: new Date().toISOString(),
      ends_at: endsAt.toISOString(),
      status: "active",
      priority,
      store_revenue_share_pct: revenueSharePct,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };
  const created = data as { id: string };

  revalidatePath("/admin/promotions");
  return { error: null, id: created.id };
}

export async function endNationalPromotionAction(
  formData: FormData,
): Promise<void> {
  const { ok } = await gate();
  if (!ok) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const service = getServiceClient();
  if (!service) return;
  await service
    .from("promotions")
    .update({
      status: "ended",
      ends_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("kind", "national");
  revalidatePath("/admin/promotions");
}
