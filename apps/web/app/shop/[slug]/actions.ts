"use server";

import { createClient } from "@/utils/supabase/server";
import { chatWithGabby, isAIConfigured } from "@/lib/ai/claude";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type Result = {
  error: string | null;
  messages: ChatMessage[];
};

/**
 * Customer-facing Gabby — warm, discovery-oriented concierge for shoppers.
 * Grounded in the store's actual inventory. No auth required (public shopper
 * experience). Megan is staff-only (Trainer); customers always hear Gabby.
 */
export async function askShopper(
  storeId: string,
  history: ChatMessage[],
  userMessage: string,
): Promise<Result> {
  const msg = userMessage.trim();
  if (!msg) return { error: null, messages: history };

  const messages: ChatMessage[] = [...history, { role: "user", content: msg }];

  const supabase = await createClient();

  // Confirm store is real (and public-readable)
  const { data: storeData } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .maybeSingle();
  const store = storeData as { id: string; name: string } | null;
  if (!store) {
    return { error: "Store not found.", messages: history };
  }

  // Build keyword set from entire conversation for inventory search
  const searchTerms = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter((w) =>
      ![
        "the", "and", "for", "with", "what", "how", "can", "you", "like",
        "want", "need", "good", "best", "have", "does", "would", "should",
        "about", "that", "this", "from", "something", "looking", "recommend",
        "suggest", "help", "tonight", "today",
      ].includes(w),
    )
    .slice(0, 6);

  // Fetch inventory matches
  let products: Array<{
    name: string;
    brand: string | null;
    varietal: string | null;
    category: string | null;
    price: number | null;
    stock_qty: number;
    tasting_notes: string | null;
    summary_for_customer: string | null;
  }> = [];

  if (searchTerms.length > 0) {
    const clauses = searchTerms
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
        "name, brand, varietal, category, price, stock_qty, tasting_notes, summary_for_customer",
      )
      .eq("store_id", storeId)
      .eq("is_active", true)
      .gt("stock_qty", 0)
      .or(clauses)
      .order("stock_qty", { ascending: false })
      .limit(12);

    products = (data ?? []) as typeof products;
  }

  // If no configured AI, return placeholder
  if (!isAIConfigured()) {
    return {
      error: null,
      messages: [
        ...messages,
        {
          role: "assistant",
          content: `I'd love to help you find the right thing! (Gabby will be online once the store finishes setup — in the meantime, feel free to browse our shelves on the left.)`,
        },
      ],
    };
  }

  try {
    const aiResponse = await chatWithGabby({
      messages,
      inventory: products,
      storeName: store.name,
    });

    return {
      error: null,
      messages: [...messages, { role: "assistant", content: aiResponse }],
    };
  } catch (e) {
    const errMsg = (e as Error).message ?? "Unknown error";
    return {
      error: `AI error: ${errMsg}`,
      messages,
    };
  }
}
