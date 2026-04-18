import { NextResponse } from "next/server";
import {
  chatWithGabby,
  isAIConfigured,
  type FeaturedForAI,
} from "@/lib/ai/claude";
import { fetchActivePromotions } from "@/lib/promotions/fetch";
import {
  getAssistServiceClient,
  loadLiveSession,
  type AssistMessage,
} from "@/lib/assist/service";

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
 * Public continuation endpoint. The scanned session id is the only
 * credential — it's a one-way UUID the employee just created. Gabby
 * logic is identical to /api/gabby/chat; the only difference is we
 * persist the conversation back to assist_sessions so the employee can
 * see it continued (and so an abandoned scan doesn't live forever).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return json({ error: "missing session id" }, { status: 400 });

  let body: { userMessage?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, { status: 400 });
  }
  const userMessage = (body.userMessage ?? "").trim();
  if (!userMessage) return json({ error: "empty message" }, { status: 400 });

  const svc = getAssistServiceClient();
  if (!svc) return json({ error: "server misconfigured" }, { status: 500 });

  const session = await loadLiveSession(id);
  if (!session) {
    return json(
      { error: "session expired or not found" },
      { status: 410 },
    );
  }

  const { data: storeRow } = await svc
    .from("stores")
    .select("id, name")
    .eq("id", session.store_id)
    .maybeSingle();
  const store = storeRow as { id: string; name: string } | null;
  if (!store) return json({ error: "store not found" }, { status: 400 });

  const messages: AssistMessage[] = [
    ...session.messages,
    { role: "user", content: userMessage },
  ];

  // Same keyword-based inventory search as /api/gabby/chat.
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
  const baseQuery = () =>
    svc
      .from("inventory")
      .select(
        "name, brand, varietal, category, price, stock_qty, tasting_notes, summary_for_customer, review_score, review_count, review_source",
      )
      .eq("store_id", store.id)
      .gt("stock_qty", 0);

  if (searchTerms.length > 0) {
    // Match the /api/gabby/chat search so handed-off conversations see
    // the same flavor/pairing-aware candidate set.
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
      .limit(12);
    products = (data ?? []) as Product[];
  }
  if (products.length === 0) {
    const { data } = await baseQuery()
      .order("stock_qty", { ascending: false })
      .limit(20);
    products = (data ?? []) as Product[];
  }

  const promos = await fetchActivePromotions(svc, store.id);
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

  let aiResponse: string;
  if (!isAIConfigured()) {
    aiResponse =
      "I'd love to help you find the right thing! Ask the staff and they'll grab it for you.";
  } else {
    try {
      aiResponse = await chatWithGabby({
        messages,
        inventory: products,
        featured,
        storeName: store.name,
      });
    } catch (e) {
      return json(
        { error: `AI error: ${(e as Error).message ?? "unknown"}` },
        { status: 500 },
      );
    }
  }

  const updated: AssistMessage[] = [
    ...messages,
    { role: "assistant", content: aiResponse },
  ];

  // Persist the conversation and mark it as handed-off on first message
  // from the customer path (i.e. every message that arrives here — the
  // employee uses the authed endpoint before the QR is scanned).
  await svc
    .from("assist_sessions")
    .update({
      messages: updated,
      status: "handed_off",
      handed_off_at: session.handed_off_at ?? new Date().toISOString(),
      last_activity: new Date().toISOString(),
    })
    .eq("id", id);

  // Log to the regular Gabby conversations table so owners see it in
  // the unified Conversations dashboard alongside self-serve chats.
  void svc
    .from("gabby_conversations")
    .insert({
      store_id: store.id,
      session_id: `assist-${id}`.slice(0, 100),
      user_message: userMessage.slice(0, 2000),
      assistant_message: aiResponse.slice(0, 4000),
      inventory_count: products.length,
    })
    .then(() => {});

  return json({
    error: null,
    messages: updated,
    expiresAt: session.expires_at,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
