import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  checkAndClaim,
  markFailed,
  markHandled,
} from "@/lib/webhooks/idempotency";

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
  message_handle?: string; // Sendblue's per-message id when present
  id?: string;
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

  // Idempotency: Sendblue sometimes redelivers on timeout. There's no
  // guaranteed native event id in the payload, so prefer message_handle
  // / id when provided, otherwise fall back to a deterministic hash of
  // the meaningful fields. Collisions on the hash path only happen for
  // byte-identical repeat payloads, which is exactly what we want to
  // dedupe anyway.
  const eventType = body.event_type ?? "unknown";
  const nativeId = body.message_handle ?? body.id ?? null;
  const eventId =
    nativeId ??
    `hash:${createHash("sha256")
      .update(
        JSON.stringify({
          e: eventType,
          f: body.from_number ?? null,
          t: body.to_number ?? null,
          c: body.content ?? null,
          o: body.is_outbound ?? null,
        }),
      )
      .digest("hex")
      .slice(0, 32)}`;

  const claim = await checkAndClaim({
    provider: "sendblue",
    eventId,
    eventType,
  });
  if (claim === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const supabase = await createClient();
  try {
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
      await markFailed("sendblue", eventId, error.message);
      console.error("sendblue webhook error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await markHandled("sendblue", eventId);
    return NextResponse.json({ ok: true, consent_id: data });
  } catch (e) {
    const msg = (e as Error)?.message ?? "unknown";
    await markFailed("sendblue", eventId, msg);
    console.error("sendblue webhook handler error:", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ready", service: "sendblue-webhook" });
}
