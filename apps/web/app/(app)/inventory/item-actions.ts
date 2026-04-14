"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type ItemFormState = { error: string | null };

async function getContext() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, storeId: null as string | null, role: null };
  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  return { supabase, storeId: p?.store_id ?? null, role: p?.role ?? null };
}

function toNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: FormDataEntryValue | null): number | null {
  const n = toNumberOrNull(v);
  return n === null ? null : Math.round(n);
}

function normalizeImageUrl(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  return null;
}

type ItemPayload = {
  name: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  size_ml: number | null;
  abv: number | null;
  price: number | null;
  cost: number | null;
  stock_qty: number;
  description: string | null;
  tasting_notes: string | null;
  image_url: string | null;
  is_active: boolean;
};

function readPayload(formData: FormData): ItemPayload | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  return {
    name,
    sku: (String(formData.get("sku") ?? "").trim() || null) as string | null,
    brand: String(formData.get("brand") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    subcategory: String(formData.get("subcategory") ?? "").trim() || null,
    size_ml: toIntOrNull(formData.get("size_ml")),
    abv: toNumberOrNull(formData.get("abv")),
    price: toNumberOrNull(formData.get("price")),
    cost: toNumberOrNull(formData.get("cost")),
    stock_qty: toIntOrNull(formData.get("stock_qty")) ?? 0,
    description: String(formData.get("description") ?? "").trim() || null,
    tasting_notes: String(formData.get("tasting_notes") ?? "").trim() || null,
    image_url: normalizeImageUrl(String(formData.get("image_url") ?? "")),
    is_active: formData.get("is_active") === "on",
  };
}

export async function createItemAction(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const { supabase, storeId, role } = await getContext();
  if (!storeId) return { error: "Not authenticated." };
  if (role !== "owner" && role !== "manager") {
    return { error: "Only owners or managers can add inventory." };
  }
  const payload = readPayload(formData);
  if ("error" in payload) return { error: payload.error };

  const { data, error } = await supabase
    .from("inventory")
    .insert({
      ...payload,
      store_id: storeId,
      image_source: payload.image_url ? "manual" : null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/inventory");
  redirect(`/inventory/${(data as { id: string }).id}`);
}

export async function updateItemAction(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing item id." };
  const { supabase, role } = await getContext();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only owners or managers can edit inventory." };
  }
  const payload = readPayload(formData);
  if ("error" in payload) return { error: payload.error };

  // If user pasted a new image URL, mark source = manual so it doesn't get
  // overwritten by future auto-enrichment runs.
  const { data: existing } = await supabase
    .from("inventory")
    .select("image_url, image_source")
    .eq("id", id)
    .maybeSingle();
  const prev = existing as { image_url: string | null; image_source: string | null } | null;
  const imageChanged = (prev?.image_url ?? null) !== payload.image_url;
  const imageSource = imageChanged
    ? payload.image_url
      ? "manual"
      : null
    : prev?.image_source ?? null;

  const { error } = await supabase
    .from("inventory")
    .update({ ...payload, image_source: imageSource })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  redirect(`/inventory/${id}`);
}

export async function deleteItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, role } = await getContext();
  if (role !== "owner" && role !== "manager") return;
  await supabase.from("inventory").delete().eq("id", id);
  revalidatePath("/inventory");
  redirect("/inventory");
}

// Quick "out of stock" / "restock" toggles used from the item detail page.
export async function adjustStockAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const delta = parseInt(String(formData.get("delta") ?? "0"), 10);
  if (!id || !Number.isFinite(delta)) return;
  const { supabase, role } = await getContext();
  if (role !== "owner" && role !== "manager") return;
  const { data } = await supabase
    .from("inventory")
    .select("stock_qty")
    .eq("id", id)
    .maybeSingle();
  const current = (data as { stock_qty?: number } | null)?.stock_qty ?? 0;
  const next = Math.max(0, current + delta);
  await supabase.from("inventory").update({ stock_qty: next }).eq("id", id);
  revalidatePath(`/inventory/${id}`);
  revalidatePath("/inventory");
}
