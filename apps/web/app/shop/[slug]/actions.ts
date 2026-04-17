"use server";

import { createClient } from "@/utils/supabase/server";
import { getAnthropic, isAIConfigured } from "@/lib/ai/claude";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type Result = {
  error: string | null;
  messages: ChatMessage[];
};

/**
 * Customer-facing Megan — warmer and more discovery-oriented than the staff
 * Assistant. Grounded in the store's actual inventory. No auth required
 * (public shopper experience).
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
    category: string | null;
    price: number | null;
    stock_qty: number;
  }> = [];

  if (searchTerms.length > 0) {
    const clauses = searchTerms
      .flatMap((k) => [
        `name.ilike.%${k}%`,
        `brand.ilike.%${k}%`,
        `category.ilike.%${k}%`,
      ])
      .join(",");

    const { data } = await supabase
      .from("inventory")
      .select("name, brand, category, price, stock_qty")
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
          content: `I'd love to help you find the right thing! (Megan AI will be online once the store finishes setup — in the meantime, feel free to browse our shelves on the left.)`,
        },
      ],
    };
  }

  const claude = getAnthropic();
  if (!claude) {
    return { error: "AI unavailable", messages };
  }

  const inventoryContext = products.length > 0
    ? products
        .map(
          (p) =>
            `- ${p.name}${p.brand ? ` (${p.brand})` : ""}${p.category ? ` [${p.category}]` : ""} — ${p.price != null ? `$${Number(p.price).toFixed(2)}` : "price N/A"}${p.stock_qty <= 3 ? ` (only ${p.stock_qty} left)` : ""}`,
        )
        .join("\n")
    : "No specific matches right now — recommend from general category knowledge and remind the customer to browse the store shelves or ask staff for exact stock.";

  const systemPrompt = `You are Megan, the AI beverage concierge at ${store.name}. You're talking DIRECTLY to a customer (not store staff). Be warm, welcoming, and genuinely excited to help them find exactly what they want.

PERSONALITY:
- Friendly and approachable, like the best bartender or shop owner you've ever met
- Confident in your recommendations — customers come to you because you know
- Never condescending — meet people where they are
- Enthusiastic about beverages without being pretentious

CONVERSATION APPROACH:
For BROAD requests ("recommend a wine", "I need a gift", "what pairs with chicken"), ask ONE quick follow-up to narrow it down:
- "What's the occasion?" or "Who's it for?"
- "Budget range — everyday or something special?"
- "Red, white, or surprise me?"
- "Sipping it neat, on the rocks, or mixing?"

For SPECIFIC requests ("Pinot Noir under $30", "peaty Scotch"), go straight to recommendations.

WHEN RECOMMENDING:
- Pick 1-2 specific products FROM OUR STOCK below
- Include the price
- One-sentence "why this is perfect for you"
- Tell them where to find it: "It's on the left wall, second shelf" or "Ask any staff member and they'll grab it for you"

STORE INVENTORY (ONLY recommend from this list — if nothing fits, be honest and suggest they ask staff):
${inventoryContext}

RULES:
- Keep replies short: 2-4 sentences MAX
- Feel human and warm, not robotic
- One follow-up question at a time
- When recommending: "I'd grab the [product] at $XX — [quick reason]. You'll find it [where]."
- If we don't carry what they want, say so and suggest the closest match`;

  try {
    const message = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const aiResponse = textBlock?.text ?? "Let me think about that — could you tell me a bit more?";

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
