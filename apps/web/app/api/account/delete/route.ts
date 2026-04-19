// POST /api/account/delete
//
// In-app account deletion — required by Apple App Store Review Guideline
// 5.1.1(v) for any app that supports signup, and required by GDPR Article 17
// and CCPA right-to-delete. The mobile Profile screen drives this.
//
// Auth model: the caller must send its Supabase session access token as a
// Bearer header. We validate the token against Supabase (with the anon key),
// pull the user_id out, then use the service-role client to call
// auth.admin.deleteUser(). That cascades to public.users (FK with ON DELETE
// CASCADE) which in turn cascades to every user-owned row — saved_products,
// cart_items, holds, progress, gamification, etc.
//
// We write an audit row BEFORE the delete so the action is always traceable
// even if the delete partially succeeds. The audit row stores only the user
// id + email, not any PII freeform fields.
//
// No rate-limit ring here — the access-token requirement already makes this
// self-scoped (an attacker needs a valid session), and over-rate-limiting a
// deletion endpoint risks trapping users who want out. Sentry captures any
// admin-delete failure so ops has eyes on it.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logAudit } from "@/lib/audit/log";

export const runtime = "nodejs";

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Server not configured for account deletion." },
      { status: 500 },
    );
  }

  // 1) Validate the token and resolve the user. Anon-key client is fine for
  //    this call — we're only asking "whose token is this?".
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

  // 2) Audit FIRST so the delete is always traceable.
  await logAudit({
    action: "account.delete",
    actor: { id: user.id, email: user.email ?? null },
    target: { type: "user", id: user.id },
    ip: req.headers.get("x-forwarded-for") ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  });

  // 3) Admin delete. Cascades through public.users → saved_products,
  //    cart_items, holds, progress, user_gamification, etc.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    Sentry.captureException(delErr, {
      tags: { route: "account-delete" },
      extra: { user_id: user.id },
    });
    return NextResponse.json(
      {
        error:
          "Couldn't delete your account. Our team has been notified — email support@bevtek.ai and we'll finish the deletion by hand.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
