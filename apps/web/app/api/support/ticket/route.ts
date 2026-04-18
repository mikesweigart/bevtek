import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Report-a-Problem endpoint. Dual-path:
 *   - Authenticated (staff or signed-in shopper): we look up the user's
 *     profile via SSR client, attach store_id + role, and insert under
 *     their auth context so RLS sees user_id = auth.uid().
 *   - Anonymous (public storefront / age-gated shopper): we require a
 *     reporter_email and use the service-role client; the anon INSERT
 *     policy on support_tickets enforces the shape.
 *
 * Rate-limited at 5/min / 30/day to keep bad actors from filling the
 * triage queue.
 *
 * Body: {
 *   subject: string,
 *   description: string,
 *   severity?: 'low'|'normal'|'high'|'urgent',
 *   surface?: string,
 *   screen?: string,
 *   app_version?: string,
 *   last_action?: string,
 *   context_json?: Record<string, unknown>,
 *   user_agent?: string,
 *   store_id?: string,            // preferred source on anonymous path
 *   reporter_email?: string,      // REQUIRED on anonymous path
 *   reporter_name?: string,
 * }
 */
type Payload = {
  subject?: string;
  description?: string;
  severity?: string;
  surface?: string;
  screen?: string;
  app_version?: string;
  last_action?: string;
  context_json?: Record<string, unknown>;
  user_agent?: string;
  store_id?: string;
  reporter_email?: string;
  reporter_name?: string;
};

const ALLOWED_SEVERITY = new Set(["low", "normal", "high", "urgent"]);

function trimTo(s: string | undefined | null, n: number): string | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.slice(0, n);
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json({ error: "bad json" }, { status: 400 });
  }

  const subject = trimTo(body.subject, 200);
  const description = trimTo(body.description, 4000);
  if (!subject || !description) {
    return json(
      { error: "subject and description are required" },
      { status: 400 },
    );
  }
  const severity =
    body.severity && ALLOWED_SEVERITY.has(body.severity) ? body.severity : "normal";

  // Resolve authenticated user (if any). Anonymous path is still allowed.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const authedUserId = auth.user?.id ?? null;

  // Rate limit: keyed by user id when signed in, otherwise by IP. Keeps a
  // single anon bucket from a shared NAT from starving a real reporter.
  const rl = await checkRate(
    "support-ticket",
    identifyRequest(req, authedUserId),
  );
  if (!rl.success) return rateLimitResponse(rl);

  // Shared insert payload fields
  const base = {
    subject,
    description,
    severity,
    surface: trimTo(body.surface, 40),
    screen: trimTo(body.screen, 120),
    app_version: trimTo(body.app_version, 60),
    last_action: trimTo(body.last_action, 200),
    context_json: body.context_json ?? null,
    user_agent:
      trimTo(body.user_agent, 500) ??
      trimTo(req.headers.get("user-agent"), 500),
  };

  if (authedUserId) {
    // Authed path — look up profile for store/role context, then insert
    // under the user's RLS context so support_tickets_insert_self matches.
    const { data: urow } = await supabase
      .from("users")
      .select("store_id, role")
      .eq("id", authedUserId)
      .maybeSingle();
    const profile = urow as { store_id: string | null; role: string | null } | null;

    const insertRow = {
      ...base,
      user_id: authedUserId,
      store_id: body.store_id ?? profile?.store_id ?? null,
      user_role: profile?.role ?? null,
      reporter_email: trimTo(body.reporter_email, 200),
      reporter_name: trimTo(body.reporter_name, 120),
    };

    const { data, error } = await supabase
      .from("support_tickets")
      .insert(insertRow)
      .select("id, created_at")
      .single();
    if (error || !data) {
      return json(
        { error: error?.message ?? "insert failed" },
        { status: 500 },
      );
    }
    return json({ ok: true, ticketId: (data as { id: string }).id });
  }

  // Anonymous path — require email so we can follow up, and use the
  // service-role client so we don't need a broad anon SELECT.
  const reporter_email = trimTo(body.reporter_email, 200);
  if (!reporter_email) {
    return json(
      { error: "reporter_email required when not signed in" },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return json({ error: "server misconfigured" }, { status: 500 });
  }
  const svc = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const insertRow = {
    ...base,
    user_id: null,
    store_id: body.store_id ?? null,
    user_role: null,
    reporter_email,
    reporter_name: trimTo(body.reporter_name, 120),
  };

  const { data, error } = await svc
    .from("support_tickets")
    .insert(insertRow)
    .select("id, created_at")
    .single();
  if (error || !data) {
    return json(
      { error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }
  return json({ ok: true, ticketId: (data as { id: string }).id });
}
