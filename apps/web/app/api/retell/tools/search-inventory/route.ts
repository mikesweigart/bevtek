import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Retell Conversation Flow tool endpoint. Wired up as a "custom function"
// node in the flow — called when Gabby needs to look up what the store
// has in stock ("do you have Buffalo Trace?", "any red wine under $30?").
//
// AUTH
//   Retell's function node is configured with:
//     Header name:  Authorization
//     Header value: Bearer <RETELL_TOOL_SECRET>
//   We verify that header against the env var below. Not HMAC — Retell's
//   Conversation Flow doesn't sign tool-call bodies — but bearer-over-HTTPS
//   is enough given the URL is unadvertised and the shared secret is long.
//
// STORE RESOLUTION
//   Pilot phase: we haven't bought a Retell phone number yet, so
//   call.to_number will be Retell's test number (or empty on the dashboard
//   simulator). Fall back to RETELL_PILOT_STORE_ID so voice testing works
//   before a number is provisioned.
//   Production: once the store has their own Retell number, we look up
//   stores.retell_phone_number = call.to_number and drop the fallback.
//
// SEARCH LOGIC
//   Mirrors /api/gabby/chat line 84–153 (keyword extraction + ilike across
//   name/brand/varietal/category/tasting_notes/summary_for_customer). Kept
//   here rather than extracted to a shared lib so web chat doesn't break
//   if we tune voice-specific behavior. When we add a third consumer
//   (shopper, text), factor both into apps/web/lib/inventory/search.ts.
//
// RESPONSE SHAPE
//   Trimmed vs. web chat — voice doesn't need review scores, SKUs, or
//   summary_for_customer (too much to read aloud). We return:
//     { found: number, items: InventoryItem[] }
//   If nothing matched, found = 0 and the LLM speaks the graceful
//   fallback line from Gabby's writing block ("we don't carry that one
//   right now — can I suggest something similar?").

export const runtime = "nodejs";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

type RetellCall = {
  call_id?: string;
  from_number?: string;
  to_number?: string;
  agent_id?: string;
  direction?: string;
};

// Retell Conversation Flow sends tool-call bodies in a few different
// shapes depending on node type (function node vs. tool use within LLM
// node). We normalize by pulling args from either `args` or `parameters`
// and call metadata from either `call` or the flat top-level fields.
type RetellToolBody = {
  name?: string;
  args?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  call?: RetellCall;
  call_id?: string;
  from_number?: string;
  to_number?: string;
  [k: string]: unknown;
};

type InventoryItem = {
  name: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  stock_qty: number;
  tasting_notes: string | null;
};

// ------------------------------------------------------------
// Keyword extraction — same stop-word set as Gabby web chat so voice
// results line up with chat results for the same phrase.
// ------------------------------------------------------------
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "what", "how", "can", "you", "like",
  "want", "need", "good", "best", "have", "does", "would", "should",
  "about", "that", "this", "from", "something", "looking", "recommend",
  "suggest", "help", "tonight", "today", "any", "got", "your", "mine",
  "please", "thanks", "yeah", "yes", "sure", "okay",
]);

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w.length <= 25 && !STOP_WORDS.has(w))
    .slice(0, 6);
}

// ------------------------------------------------------------
// Store resolution: to_number → stores.retell_phone_number → id
// ------------------------------------------------------------
async function resolveStoreId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  call: RetellCall | undefined,
  flatToNumber: string | undefined,
): Promise<{ storeId: string | null; source: string }> {
  const toNumber = call?.to_number ?? flatToNumber ?? null;

  if (toNumber) {
    const { data } = await supabase
      .from("stores")
      .select("id")
      .eq("retell_phone_number", toNumber)
      .maybeSingle();
    const row = data as { id: string } | null;
    if (row?.id) return { storeId: row.id, source: `to_number=${toNumber}` };
  }

  // Pilot fallback. Strip here once every store has a provisioned number.
  const pilot = process.env.RETELL_PILOT_STORE_ID;
  if (pilot) return { storeId: pilot, source: "RETELL_PILOT_STORE_ID" };

  return { storeId: null, source: "unresolved" };
}

// ------------------------------------------------------------
// Handler
// ------------------------------------------------------------
export async function POST(req: Request) {
  // 1. Auth
  const expected = process.env.RETELL_TOOL_SECRET;
  if (!expected) {
    // Misconfiguration — fail hard so we don't silently accept anyone.
    console.error("[retell/search-inventory] RETELL_TOOL_SECRET not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: RetellToolBody;
  try {
    body = (await req.json()) as RetellToolBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const argsObj = body.args ?? body.parameters ?? {};
  const query = typeof argsObj.query === "string" ? argsObj.query.trim() : "";
  if (!query) {
    return NextResponse.json(
      { error: "args.query required (string)", found: 0, items: [] },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // 3. Resolve which store is calling
  const { storeId, source } = await resolveStoreId(
    supabase,
    body.call,
    body.to_number,
  );
  if (!storeId) {
    // Return a soft failure so the LLM can apologize — not a 500 which
    // would cause Retell to retry or escalate.
    console.warn("[retell/search-inventory] store not resolved", { body });
    return NextResponse.json({
      found: 0,
      items: [],
      note: "store_not_resolved",
    });
  }

  // 4. Build the search
  const keywords = extractKeywords(query);

  type Row = {
    name: string;
    brand: string | null;
    category: string | null;
    price: number | null;
    stock_qty: number;
    tasting_notes: string | null;
  };

  const baseQuery = () =>
    supabase
      .from("inventory")
      .select("name, brand, category, price, stock_qty, tasting_notes")
      .eq("store_id", storeId)
      .gt("stock_qty", 0);

  let rows: Row[] = [];

  if (keywords.length > 0) {
    const clauses = keywords
      .flatMap((k) => [
        `name.ilike.%${k}%`,
        `brand.ilike.%${k}%`,
        `varietal.ilike.%${k}%`,
        `category.ilike.%${k}%`,
        `tasting_notes.ilike.%${k}%`,
        `summary_for_customer.ilike.%${k}%`,
      ])
      .join(",");

    const { data, error } = await baseQuery()
      .or(clauses)
      .order("stock_qty", { ascending: false })
      .limit(5); // Voice cap: 5 items is plenty; LLM should mention ≤3

    if (error) {
      Sentry.captureException(error, {
        tags: { route: "retell/search-inventory" },
        extra: { store_source: source, keywords },
      });
      return NextResponse.json(
        { error: "search_failed", found: 0, items: [] },
        { status: 500 },
      );
    }
    rows = (data ?? []) as Row[];
  }

  // No keyword hits — return empty so Gabby falls back to the scripted
  // "don't carry that one, can I suggest something similar?" from her
  // writing block. We intentionally don't fall back to "top stocked
  // items" like web chat does: voice can't gracefully list 5 unrelated
  // products, and guessing is worse than asking a clarifying question.
  const items: InventoryItem[] = rows.map((r) => ({
    name: r.name,
    brand: r.brand,
    category: r.category,
    price: r.price,
    stock_qty: r.stock_qty,
    tasting_notes: r.tasting_notes,
  }));

  return NextResponse.json({
    found: items.length,
    items,
  });
}

// Retell dashboard may ping the URL with GET for health / reachability.
export async function GET() {
  return NextResponse.json({ status: "ready", tool: "search-inventory" });
}
