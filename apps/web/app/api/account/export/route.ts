// POST /api/account/export
//
// GDPR Art. 20 — Right to Data Portability. Returns a JSON bundle of
// everything we've collected about the authenticated user, in a
// "commonly-used, machine-readable" form. Paired with /api/account/delete
// so the shopper can get a copy before erasing.
//
// The same Bearer-token auth as the delete endpoint — the mobile Profile
// screen posts its Supabase access token, we validate, then read user-
// owned tables via service role (bypassing RLS is fine here because we
// scope every query to `user_id = <validated caller's id>`).
//
// Scope (kept deliberately narrow):
//   - users              — the profile row
//   - saved_products     — bookmarks
//   - cart_items         — current virtual cart
//   - hold_requests      — where the user is the customer_user_id
//   - progress           — trainer module progress
//   - user_gamification  — stars, streaks, level
//
// Deliberately excluded:
//   - audit_events that name them as actor (admin/ops metadata, not their data)
//   - call_logs / floor_queries (store-owned, store is the controller)
//   - webhook_events (service internal; no user-identifiable payload)
//
// Response shape is explicitly versioned so we can evolve it without
// breaking downstream parsers. If a shopper pipes this into Takeout.app
// or a personal export tool, they need a stable schema.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logAudit } from "@/lib/audit/log";
import { checkRate, identifyRequest, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EXPORT_SCHEMA_VERSION = 1;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <access_token>." },
      { status: 401 },
    );
  }
  const accessToken = m[1];

  // Rate-limit by the requesting IP. We can't key by user id yet because
  // we haven't validated the token — but a legitimate shopper only needs
  // 1-2 exports ever, so even a per-IP cap of 10/day is generous.
  const rl = await checkRate("account-export", identifyRequest(req));
  if (!rl.success) return rateLimitResponse(rl);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Server not configured for account export." },
      { status: 500 },
    );
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error: userErr } = await anon.auth.getUser(accessToken);
  if (userErr || !userRes?.user) {
    return NextResponse.json(
      { error: "Invalid or expired session." },
      { status: 401 },
    );
  }
  const user = userRes.user;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch everything in parallel. Failures on any one bucket degrade
  // gracefully to an empty array so the shopper still gets the rest.
  const safe = async <T>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
    try {
      const { data } = await p;
      return data ?? [];
    } catch (e) {
      Sentry.captureException(e, {
        tags: { route: "account-export", user_id: user.id },
      });
      return [];
    }
  };

  const [profile, saved, cart, holds, progress, gamification] = await Promise.all([
    safe(
      admin
        .from("users")
        .select("id, email, full_name, role, store_id, created_at")
        .eq("id", user.id),
    ),
    safe(
      admin
        .from("saved_products")
        .select("item_id, created_at")
        .eq("user_id", user.id),
    ),
    safe(
      admin
        .from("cart_items")
        .select("item_id, quantity, created_at")
        .eq("user_id", user.id),
    ),
    safe(
      admin
        .from("hold_requests")
        .select(
          "id, inventory_id, store_id, quantity, notes, status, notify_channel, phone, email, created_at",
        )
        .eq("customer_user_id", user.id),
    ),
    safe(
      admin
        .from("progress")
        .select("module_id, status, stars_earned, updated_at")
        .eq("user_id", user.id),
    ),
    safe(
      admin
        .from("user_gamification")
        .select(
          "total_stars, current_streak_days, longest_streak_days, last_active_at",
        )
        .eq("id", user.id),
    ),
  ]);

  // Audit AFTER the successful read so we only log real exports, not
  // accidental 500s. The audit row itself is not part of the export.
  await logAudit({
    action: "account.export",
    actor: { id: user.id, email: user.email ?? null },
    target: { type: "user", id: user.id },
    metadata: {
      counts: {
        saved: saved.length,
        cart: cart.length,
        holds: holds.length,
        progress: progress.length,
      },
    },
    ip: req.headers.get("x-forwarded-for") ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  });

  const payload = {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    profile: profile[0] ?? null,
    saved_products: saved,
    cart_items: cart,
    hold_requests: holds,
    trainer_progress: progress,
    gamification: gamification[0] ?? null,
    note:
      "This is a copy of the personal data BevTek.ai stores about your account. " +
      "Store-specific purchase history, if any, is held by the individual retailer " +
      "and must be requested from them directly. See /privacy for the full policy.",
  };

  // Content-Disposition so a browser download gets a sensible filename —
  // mobile just reads body, desktop gets a proper Save As.
  const filename = `bevtek-account-export-${user.id}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
