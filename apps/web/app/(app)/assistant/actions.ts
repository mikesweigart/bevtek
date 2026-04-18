"use server";

import { createClient } from "@/utils/supabase/server";
import { chatWithMegan, isAIConfigured, type ChatMessage } from "@/lib/ai/claude";

export type { ChatMessage } from "@/lib/ai/claude";

export type ChatState = {
  error: string | null;
  messages: ChatMessage[];
  products: Array<{
    id: string;
    name: string;
    brand: string | null;
    varietal: string | null;
    category: string | null;
    price: number | null;
    stock_qty: number;
    tasting_notes: string | null;
    summary_for_customer: string | null;
  }>;
};

export async function sendMessageAction(
  history: ChatMessage[],
  userMessage: string,
): Promise<ChatState> {
  if (!userMessage.trim()) {
    return { error: null, messages: history, products: [] };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "Not authenticated.", messages: history, products: [] };
  }

  const messages: ChatMessage[] = [
    ...history,
    { role: "user", content: userMessage.trim() },
  ];

  // Search inventory using terms from entire conversation
  const searchTerms = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  const keywords = searchTerms
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter(
      (w) =>
        !["the", "and", "for", "with", "what", "how", "can", "you",
          "like", "want", "need", "good", "best", "have", "does",
          "would", "should", "about", "that", "this", "from",
          "something", "looking", "recommend", "suggest", "help",
        ].includes(w),
    );

  let products: ChatState["products"] = [];
  if (keywords.length > 0) {
    const fuzzy = await supabase.rpc("fuzzy_search_inventory", {
      p_query: keywords.slice(0, 3).join(" "),
      p_limit: 15,
    });

    if (!fuzzy.error && fuzzy.data) {
      // fuzzy_search_inventory is a legacy RPC that predates the
      // varietal/tasting-notes columns. Hydrate from inventory so Megan
      // sees the same enriched fields Gabby does.
      const baseRows = (fuzzy.data as Array<{ id: string }>) ?? [];
      const ids = baseRows.map((r) => r.id).filter(Boolean);
      if (ids.length > 0) {
        const { data: enriched } = await supabase
          .from("inventory")
          .select(
            "id, name, brand, varietal, category, price, stock_qty, tasting_notes, summary_for_customer",
          )
          .in("id", ids);
        // Preserve the fuzzy-ranking order that the RPC returned.
        const byId = new Map(
          ((enriched as ChatState["products"] | null) ?? []).map((p) => [p.id, p]),
        );
        products = ids
          .map((id) => byId.get(id))
          .filter((p): p is ChatState["products"][number] => !!p);
      }
    } else {
      const clauses = keywords
        .slice(0, 5)
        .flatMap((k) => [
          `name.ilike.%${k}%`,
          `brand.ilike.%${k}%`,
          `varietal.ilike.%${k}%`,
          `category.ilike.%${k}%`,
        ])
        .join(",");
      const { data } = await supabase
        .from("inventory")
        .select(
          "id, name, brand, varietal, category, price, stock_qty, tasting_notes, summary_for_customer",
        )
        .or(clauses)
        .eq("is_active", true)
        .order("stock_qty", { ascending: false })
        .limit(15);
      products = (data as ChatState["products"] | null) ?? [];
    }
  }

  // Store name for context
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

  // Get Megan's conversational response
  let aiResponse: string;
  if (!isAIConfigured()) {
    aiResponse = "Megan AI is not connected yet. Add the ANTHROPIC_API_KEY environment variable in Vercel and redeploy.";
  } else {
    try {
      aiResponse = await chatWithMegan({
        messages,
        inventory: products.map((p) => ({
          name: p.name,
          brand: p.brand,
          varietal: p.varietal,
          category: p.category,
          price: p.price,
          stock_qty: p.stock_qty,
          tasting_notes: p.tasting_notes,
          summary_for_customer: p.summary_for_customer,
        })),
        storeName,
      });
    } catch (e) {
      const errMsg = (e as Error).message ?? "Unknown error";
      console.error("Claude error:", errMsg);
      aiResponse = `Error from AI: ${errMsg}. Check that your Anthropic API key is valid and has billing enabled at console.anthropic.com.`;
    }
  }

  const updatedMessages: ChatMessage[] = [
    ...messages,
    { role: "assistant", content: aiResponse },
  ];

  // Log
  if (storeId) {
    await supabase.from("floor_queries").insert({
      store_id: storeId,
      user_id: auth.user.id,
      query_text: userMessage.trim(),
      response: aiResponse,
      item_ids: products.map((p) => p.id),
      context: { ai: true, turn: messages.length },
    });
  }

  return { error: null, messages: updatedMessages, products };
}
