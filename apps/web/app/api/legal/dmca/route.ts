// Public DMCA takedown submission endpoint.
//
// Accepts unauthenticated POST from /dmca form. Writes to `dmca_reports`
// (service-role, since the table is RLS-on-no-policies). Captures IP +
// user-agent for the provenance record.
//
// Rate-limited per-IP so a script can't fill the queue with garbage.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { checkRate } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  claimant_name?: unknown;
  claimant_email?: unknown;
  claimant_phone?: unknown;
  claimant_address?: unknown;
  claimant_authorized_to_act?: unknown;
  copyrighted_work_description?: unknown;
  infringing_url?: unknown;
  good_faith_statement?: unknown;
  accuracy_statement?: unknown;
  signature?: unknown;
};

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

function bool(v: unknown): boolean {
  return v === true;
}

export async function POST(req: Request) {
  // Rate-limit by IP — reuse the account-export bucket's shape (2/min,
  // 10/day) which is appropriately tight for a form that a legit human
  // submits once.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "anon";
  const rl = await checkRate("account-export", `ip:${ip}`);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Try again later." },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Invalid JSON body.");
  }

  const claimantName = str(body.claimant_name, 200);
  const claimantEmail = str(body.claimant_email, 320);
  const claimantPhone = typeof body.claimant_phone === "string"
    ? body.claimant_phone.trim().slice(0, 40) || null
    : null;
  const claimantAddress = typeof body.claimant_address === "string"
    ? body.claimant_address.trim().slice(0, 500) || null
    : null;
  const authorized = bool(body.claimant_authorized_to_act);
  const workDesc = str(body.copyrighted_work_description, 5000);
  const infringingUrl = str(body.infringing_url, 2000);
  const goodFaith = bool(body.good_faith_statement);
  const accuracy = bool(body.accuracy_statement);
  const signature = str(body.signature, 200);

  // Required field validation — mirrors the form's `required` attributes
  // plus the "must check both statements" rule.
  if (!claimantName) return bad("Full legal name is required.");
  if (!claimantEmail) return bad("Email is required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(claimantEmail)) {
    return bad("Email looks invalid.");
  }
  if (!authorized) {
    return bad("You must confirm you are authorized to act on behalf of the copyright owner.");
  }
  if (!workDesc) return bad("Description of the copyrighted work is required.");
  if (!infringingUrl) return bad("URL of the allegedly infringing content is required.");
  try {
    const parsed = new URL(infringingUrl);
    if (!/^https?:$/.test(parsed.protocol)) {
      return bad("Infringing URL must use http or https.");
    }
  } catch {
    return bad("Infringing URL is not a valid URL.");
  }
  if (!goodFaith) return bad("You must affirm the good-faith statement.");
  if (!accuracy) return bad("You must affirm the accuracy statement.");
  if (!signature) return bad("Electronic signature (typed name) is required.");

  const client = svc();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Server misconfigured." },
      { status: 500 },
    );
  }

  const { data, error } = await client
    .from("dmca_reports")
    .insert({
      claimant_name: claimantName,
      claimant_email: claimantEmail,
      claimant_phone: claimantPhone,
      claimant_address: claimantAddress,
      claimant_authorized_to_act: authorized,
      copyrighted_work_description: workDesc,
      infringing_url: infringingUrl,
      good_faith_statement: goodFaith,
      accuracy_statement: accuracy,
      signature,
      ip,
      user_agent: req.headers.get("user-agent"),
    })
    .select("id")
    .single();

  if (error) {
    Sentry.captureException(error, { tags: { route: "dmca_submit" } });
    return NextResponse.json(
      { ok: false, error: "Couldn't record your notice. Please email our DMCA agent directly." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, referenceId: String(data.id) });
}
