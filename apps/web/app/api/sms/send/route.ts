import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkRate, identifyRequest, rateLimitResponse } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms/sendblue";

export const runtime = "nodejs";

// Outbound SMS endpoint — staff-authenticated.
//
// WHAT IT'S FOR
//   The small pile of server actions that want to text a customer:
//   hold ready-for-pickup, Retell post-call summary, manual "reply to
//   a consent opt-in" from the Texting dashboard. Rather than each of
//   those importing the Sendblue wrapper directly, they can POST here.
//   The route handles auth + rate-limit + consent once.
//
// AUTH
//   Requires a signed-in session. The caller's `users.store_id` is the
//   authoritative scope — we never trust a `storeId` field from the
//   body. An owner managing multiple stores in the future would switch
//   store context via session/cookie, not by passing it in the body.
//
// COMPLIANCE
//   - Marketing/promo sends: require an active sms_consent row. Default.
//   - Transactional sends (hold ready, order update): pass
//     requireConsent=false. Our TOS + A2P 10DLC registration cover the
//     narrow transactional exception. Callers MUST have a human-written
//     justification in the calling code — don't flip this from a UI.
//
// RATE LIMIT
//   20/min and 200/day PER USER. Staff burst for a queue restock is
//   fine; a compromised account burning 1,000+ messages in a day is not.

type SendPayload = {
  toNumber?: string;
  message?: string;
  /** Pass `false` only for clear transactional use-cases. See file header. */
  requireConsent?: boolean;
  /** Optional free-form tag surfaced to Sentry. e.g. "hold_ready", "call_summary". */
  purpose?: string;
};

export async function POST(req: Request) {
  let body: SendPayload;
  try {
    body = (await req.json()) as SendPayload;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const toNumber = (body.toNumber ?? "").trim();
  // 1 SMS = 160 chars; 1 iMessage is practically unbounded but Sendblue
  // recommends <= 4KB. Cap at 1200 to leave room for url shortening and
  // keep costs sane.
  const message = (body.message ?? "").trim().slice(0, 1200);

  if (!toNumber || !message) {
    return NextResponse.json(
      { error: "toNumber and message required" },
      { status: 400 },
    );
  }

  // Auth + scope lookup. We read the user's profile (store_id + role)
  // rather than calling current_store_id() RPC so we can also check role
  // and return a helpful 403 instead of silently sending nothing.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as { store_id: string | null; role: string | null } | null;
  if (!p?.store_id) {
    return NextResponse.json(
      { error: "no store context for this user" },
      { status: 403 },
    );
  }

  // Only staff roles may send. Block any "shopper" / customer-app users
  // that might somehow end up with a session here.
  const allowedRoles = new Set(["owner", "admin", "manager", "staff"]);
  if (!p.role || !allowedRoles.has(p.role)) {
    return NextResponse.json(
      { error: "role not permitted to send SMS" },
      { status: 403 },
    );
  }

  // Rate-limit bucketed by user id — staff burst behavior is per-person,
  // not per-store, so 5 staff members naturally get 5x the ceiling.
  const rl = await checkRate("sms-send", identifyRequest(req, user.id));
  if (!rl.success) return rateLimitResponse(rl);

  const result = await sendSms({
    supabase,
    storeId: p.store_id,
    toNumber,
    message,
    requireConsent: body.requireConsent ?? true,
    purpose: body.purpose ?? "api_sms_send",
  });

  if (!result.ok) {
    // Map known reasons to appropriate HTTP status codes so clients can
    // branch without parsing the reason string.
    const status =
      result.reason === "sendblue_not_configured" ||
      result.reason === "store_not_configured"
        ? 503 // service not provisioned
        : result.reason === "bad_recipient" || result.reason === "empty_message"
          ? 400
          : result.reason === "no_consent"
            ? 409 // conflict — not a send error, just not allowed yet
            : 502; // upstream Sendblue failure
    return NextResponse.json(
      { error: result.reason, detail: "detail" in result ? result.detail : undefined },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    messageHandle: result.messageHandle,
    from: result.from,
    to: result.to,
  });
}
