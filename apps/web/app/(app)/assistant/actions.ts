"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { askMegan, isAIConfigured } from "@/lib/ai/claude";

export type AssistantState = {
  error: string | null;
  query: string | null;
  aiResponse: string | null;
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

const initial: AssistantState = {
  error: null,
  query: null,
  aiResponse: null,
  results: [],
};

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

  // Search inventory for matching products
  let results: AssistantState["results"] = [];

  if (keywords.length > 0) {
    const fuzzy = await supabase.rpc("fuzzy_search_inventory", {
      p_query: q,
      p_limit: 20,
    });

    if (!fuzzy.error && fuzzy.data) {
      results = (fuzzy.data as AssistantState["results"]) ?? [];
    } else {
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

      results = items ?? [];
    }
  }

  // Get store name for Claude context
  const { data: profile } = await supabase
    .from("users")
    .select("store_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const storeId = (profile as { store_id?: string } | null)?.store_id;

  let storeName = "your store";
  if (storeId) {
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .maybeSingle();
    storeName = (store as { name?: string } | null)?.name ?? storeName;
  }

  // If Claude is configured, get an AI-powered response
  let aiResponse: string | null = null;
  if (isAIConfigured()) {
    try {
      aiResponse = await askMegan({
        query: q,
        inventory: results.map((r) => ({
          name: r.name,
          brand: r.brand,
          category: r.category,
          price: r.price,
          stock_qty: r.stock_qty,
        })),
        storeName,
      });
    } catch (e) {
      console.error("Claude error:", (e as Error).message);
      // Fall through to inventory-only response
    }
  }

  // Log the query
  if (storeId) {
    await supabase.from("floor_queries").insert({
      store_id: storeId,
      user_id: auth.user.id,
      query_text: q,
      response: aiResponse ?? `Found ${results.length} matching items.`,
      item_ids: results.map((r) => r.id),
      context: { keywords, ai: Boolean(aiResponse) },
    });
  }

  revalidatePath("/assistant");
  return { error: null, query: q, aiResponse, results };
}
