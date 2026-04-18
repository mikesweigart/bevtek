import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { AssistMessage } from "@/lib/assist/service";
import { checkRate, identifyRequest, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Employee creates a hand-off session. The mobile Gabby tab posts the
 * current conversation + the employee's store id; we persist it so the
 * customer can scan the QR on their own phone and continue uninterrupted.
 *
 * Auth: any authenticated staff member in the same store. RLS on
 * assist_sessions enforces the store match on the INSERT.
 */
export async function POST(req: Request) {
  let body: { messages?: AssistMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const rl = await checkRate("assist-create", identifyRequest(req, auth.user.id));
  if (!rl.success) return rateLimitResponse(rl);

  const { data: urow } = await supabase
    .from("users")
    .select("store_id, role, stores(slug)")
    .eq("id", auth.user.id)
    .maybeSingle();
  const profile = urow as {
    store_id: string | null;
    role: string | null;
    stores: { slug: string | null } | null;
  } | null;
  if (!profile?.store_id) {
    return NextResponse.json({ error: "no store" }, { status: 400 });
  }
  if (profile.role === "customer") {
    return NextResponse.json({ error: "employees only" }, { status: 403 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];

  const { data: inserted, error } = await supabase
    .from("assist_sessions")
    .insert({
      store_id: profile.store_id,
      employee_id: auth.user.id,
      messages,
      status: "active",
    })
    .select("id, expires_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  const row = inserted as { id: string; expires_at: string };
  const slug = profile.stores?.slug ?? null;

  return NextResponse.json({
    sessionId: row.id,
    slug,
    expiresAt: row.expires_at,
  });
}
