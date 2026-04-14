"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type AssistantState = {
  error: string | null;
  query: string | null;
  results: Array<{
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    price: number | null;
    stock_qty: number;
    sku: string | null;
  }>;
};

const initial: AssistantState = { error: null, query: null, results: [] };

// Very lightweight keyword extractor. We'll replace with an LLM later.
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "we", "you", "they", "have", "has", "do",
  "does", "did", "any", "some", "of", "for", "in", "on", "with", "and", "or",
  "to", "from", "that", "this", "it", "its", "me", "my", "our",
  "got", "get", "can", "what", "which", "who", "how", "about", "please",
  "show", "find", "give", "tell", "me",
]);

function extractKeywords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export async function askAction(
  _prev: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const q = String(formData.get("query") ?? "").trim();
  if (!q) return initial;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ...initial, error: "Not authenticated." };

  const keywords = extractKeywords(q);
  if (keywords.length === 0) {
    return { error: null, query: q, results: [] };
  }

  // Build OR filter across name/brand/category for each keyword.
  const clauses = keywords
    .flatMap((k) => [
      `name.ilike.%${k}%`,
      `brand.ilike.%${k}%`,
      `category.ilike.%${k}%`,
    ])
    .join(",");

  const { data: items } = (await supabase
    .from("inventory")
    .select("id, name, brand, category, price, stock_qty, sku")
    .or(clauses)
    .eq("is_active", true)
    .order("stock_qty", { ascending: false })
    .limit(20)) as { data: AssistantState["results"] | null };

  const results = items ?? [];

  // Log the query with matching ids.
  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id;

  if (storeId) {
    await supabase.from("floor_queries").insert({
      store_id: storeId,
      user_id: auth.user.id,
      query_text: q,
      response: results.length
        ? `Found ${results.length} matching item${results.length === 1 ? "" : "s"}.`
        : "No matches in current inventory.",
      item_ids: results.map((r) => r.id),
      context: { keywords },
    });
  }

  revalidatePath("/assistant");
  return { error: null, query: q, results };
}
