import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Sendblue webhook handler.
// Sendblue docs: https://sendblue.co/docs/webhooks
//
// Sends us events when customers reply to or opt in/out of your iMessage number.
// Auth is via a shared secret (set per-store in /settings → Texting).

type SendbluePayload = {
  secret?: string;
  event_type?: string; // e.g. "message.received", "consent.opt_in", "consent.opt_out"
  from_number?: string;
  to_number?: string;
  content?: string;
  is_outbound?: boolean;
  [k: string]: unknown;
};

export async function POST(request: NextRequest) {
  let body: SendbluePayload;
  try {
    body = (await request.json()) as SendbluePayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const secret =
    request.headers.get("x-webhook-secret") ?? body.secret ?? null;
  if (!secret) {
    return NextResponse.json({ error: "missing secret" }, { status: 401 });
  }

  const phone = body.from_number;
  if (!phone) {
    return NextResponse.json(
      { error: "missing from_number" },
      { status: 400 },
    );
  }

  const isOptOut =
    body.event_type === "consent.opt_out" ||
    /\b(stop|unsubscribe|opt[- ]?out)\b/i.test(body.content ?? "");
  const isOptIn =
    body.event_type === "consent.opt_in" ||
    /\b(start|yes|subscribe|opt[- ]?in)\b/i.test(body.content ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("webhook_log_sms", {
    p_secret: secret,
    p_phone: phone,
    p_consented: isOptOut ? false : isOptIn ? true : null,
    p_source: body.event_type ?? "webhook",
    p_metadata: {
      event_type: body.event_type,
      content_preview: body.content?.slice(0, 200) ?? null,
    },
  });

  if (error) {
    console.error("sendblue webhook error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, consent_id: data });
}

export async function GET() {
  return NextResponse.json({ status: "ready", service: "sendblue-webhook" });
}
