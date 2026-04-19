import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { chatWithGabby, isAIConfigured, type ChatMessage, type FeaturedForAI } from "@/lib/ai/claude";
import { fetchActivePromotions } from "@/lib/promotions/fetch";
import { checkRate, identifyRequest, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, init: { status?: number } = {}) {
  return NextResponse.json(body, { status: init.status ?? 200, headers: CORS });
}

/**
 * Public Gabby chat endpoint. Used by the mobile customer app and any
 * other customer-facing surface. No auth required — customers may be
 * browsing anonymously. Requires storeId so Gabby can ground her
 * recommendations in real inventory.
 *
 * Body: { storeId: string, messages: ChatMessage[], userMessage: string }
 * Returns: { messages: ChatMessage[], error: string | null }
 */
export async function POST(req: Request) {
  let body: {
    storeId?: string;
    messages?: ChatMessage[];
    userMessage?: string;
    sessionId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, { status: 400 });
  }

  // Rate limit first — identify by sessionId when present so a single
  // shopper on shared store Wi-Fi doesn't starve their neighbor.
  const rl = await checkRate(
    "gabby-chat",
    identifyRequest(req, body.sessionId ?? null),
  );
  if (!rl.success) return rateLimitResponse(rl);

  const storeId = body.storeId;
  // Cap the inbound conversation so a single bad actor can't drive up
  // Claude cost by pasting a novel. 20 turns is well past any natural
  // shopper exchange; 1000 chars/message is generous for voice-to-text.
  const rawHistory: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
  const history: ChatMessage[] = rawHistory.slice(-20).map((m) => ({
    role: m.role,
    content: String(m.content ?? "").slice(0, 1000),
  }));
  const userMessage = (body.userMessage ?? "").trim().slice(0, 1000);

  if (!storeId) return json({ error: "storeId required" }, { status: 400 });
  if (!userMessage) {
    return json({ error: null, messages: history });
  }

  const messages: ChatMessage[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const supabase = await createClient();

  const { data: storeData } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .maybeSingle();
  const store = storeData as { id: string; name: string } | null;
  if (!store) {
    return json({ error: "store not found", messages: history }, { status: 400 });
  }

  // Keyword search across the conversation to surface inventory for Gabby
  const searchTerms = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter(
      (w) =>
        ![
          "the", "and", "for", "with", "what", "how", "can", "you", "like",
          "want", "need", "good", "best", "have", "does", "would", "should",
          "about", "that", "this", "from", "something", "looking", "recommend",
          "suggest", "help", "tonight", "today",
        ].includes(w),
    )
    .slice(0, 6);

  type Product = {
    name: string;
    brand: string | null;
    varietal: string | null;
    category: string | null;
    price: number | null;
    stock_qty: number;
    tasting_notes: string | null;
    summary_for_customer: string | null;
    review_score: number | null;
    review_count: number | null;
    review_source: string | null;
  };
  let products: Product[] = [];

  // Base query: every in-stock item for this store. We DON'T filter on
  // is_active here — many imports leave that NULL, which would silently
  // hide the entire catalog from Gabby. Better to show too much than
  // nothing.
  const baseQuery = () =>
    supabase
      .from("inventory")
      .select(
        "name, brand, varietal, category, price, stock_qty, tasting_notes, summary_for_customer, review_score, review_count, review_source",
      )
      .eq("store_id", storeId)
      .gt("stock_qty", 0);

  if (searchTerms.length > 0) {
    // Include tasting_notes + summary_for_customer so flavor-profile and
    // pairing asks ("smoky", "pairs with salmon", "light bodied") can
    // actually match products whose names don't contain those words.
    // Gabby's system prompt already knows to quote tasting notes; this
    // is what gets those products INTO her context in the first place.
    const clauses = searchTerms
      .flatMap((k) => [
        `name.ilike.%${k}%`,
        `brand.ilike.%${k}%`,
        `varietal.ilike.%${k}%`,
        `category.ilike.%${k}%`,
        `tasting_notes.ilike.%${k}%`,
        `summary_for_customer.ilike.%${k}%`,
      ])
      .join(",");

    const { data } = await baseQuery()
      .or(clauses)
      .order("stock_qty", { ascending: false })
      .limit(10);
    products = (data ?? []) as Product[];
  }

  // Fallback: if keyword search matched nothing (or no keywords at all),
  // give Gabby a baseline of the store's top-stocked items so she can
  // still recommend real products with real prices.
  //
  // Cap at 10 items (down from 20): with notes-per-item and 5 stores of
  // concurrent traffic we were nearing the 30k input-tokens/min ceiling.
  // Empirically 10 is enough for Gabby to find a sensible match on the
  // no-keyword turns without draining the rate-limit bucket.
  if (products.length === 0) {
    const { data } = await baseQuery()
      .order("stock_qty", { ascending: false })
      .limit(10);
    products = (data ?? []) as Product[];
  }

  // Featured/sponsored boost — fetch the store's active promos so Gabby
  // can weave them in when they fit. Cheap single-RPC call, and the RPC
  // already drops anything without matching in-stock inventory.
  const promos = await fetchActivePromotions(supabase, storeId);
  const featured: FeaturedForAI[] = promos.map((p) => ({
    name: p.inventory_name,
    brand: p.inventory_brand,
    varietal: p.inventory_varietal,
    price: p.inventory_price,
    stock_qty: p.inventory_stock_qty,
    tagline: p.tagline,
    summary: p.inventory_summary,
    kind: p.kind,
  }));

  if (!isAIConfigured()) {
    return json({
      error: null,
      messages: [
        ...messages,
        {
          role: "assistant",
          content:
            "I'd love to help you find the right thing! (Gabby will be online once the store finishes setup — in the meantime, feel free to browse the shelves.)",
        },
      ],
    });
  }

  try {
    const aiResponse = await chatWithGabby({
      messages,
      inventory: products,
      featured,
      storeName: store.name,
      storeId: store.id,
    });

    // Fire-and-forget: log the conversation turn so owners can review
    // real customer chats in the Conversations dashboard. Never block the
    // user's reply on logging — if it fails, Gabby still answers.
    const sessionId = (body.sessionId ?? "").trim() || `anon-${Date.now()}`;
    void supabase
      .from("gabby_conversations")
      .insert({
        store_id: store.id,
        session_id: sessionId.slice(0, 100),
        user_message: userMessage.slice(0, 2000),
        assistant_message: aiResponse.slice(0, 4000),
        inventory_count: products.length,
      })
      .then(() => {});

    return json({
      error: null,
      messages: [...messages, { role: "assistant", content: aiResponse }],
      inventoryCount: products.length,
      sessionId,
    });
  } catch (e) {
    // Forward to Sentry so we notice production AI failures before a
    // customer complains. Tag with storeId so we can filter per-tenant
    // in the Sentry UI when triaging.
    Sentry.captureException(e, {
      tags: { route: "gabby-chat", store_id: store.id },
    });
    return json(
      { error: `AI error: ${(e as Error).message ?? "unknown"}`, messages },
      { status: 500 },
    );
  }
}

// CORS preflight — mobile Expo app hits this cross-origin.
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
