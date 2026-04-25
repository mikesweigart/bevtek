import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  checkAndClaim,
  markFailed,
  markHandled,
} from "@/lib/webhooks/idempotency";
import { sendSms } from "@/lib/sms/sendblue";
import type { SupabaseClient } from "@supabase/supabase-js";

// Retell AI posts call lifecycle events here.
// Retell docs: https://docs.retellai.com/api-references/webhook
//
// The store owner pastes the per-store webhook secret into Retell's dashboard.
// Retell sends the secret back to us either in a header or embedded in the
// payload depending on the setup. We accept either:
//   - Header: x-webhook-secret
//   - Body:   { secret: "..." }
//
// Payload shape (subset we use):
//   {
//     event: "call_started" | "call_ended" | "call_analyzed",
//     call: {
//       call_id, from_number, to_number, call_status,
//       duration_ms, transcript, call_summary, recording_url,
//       start_timestamp, end_timestamp
//     }
//   }

type RetellPayload = {
  event?: string;
  secret?: string;
  call?: {
    call_id?: string;
    from_number?: string;
    to_number?: string;
    call_status?: string;
    duration_ms?: number;
    transcript?: string;
    call_summary?: string;
    recording_url?: string;
    start_timestamp?: number;
    end_timestamp?: number;
  };
  [k: string]: unknown;
};

function toIso(ms: number | undefined): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

// ---------------------------------------------------------------------------
// Post-call SMS summary
// ---------------------------------------------------------------------------
// When Retell finishes analysis of a call, we may want to text the caller
// a one-paragraph summary ("Thanks for calling Grapes & Grains! We talked
// about Buffalo Trace — we have it in stock for $34. Reply STOP to opt
// out."). This is entirely opt-in:
//   1. The caller must have an active sms_consent row (store_id, phone).
//      We never auto-opt a caller just because they called.
//   2. The store must have a sendblue_number configured and outbound
//      Sendblue credentials present (checked inside sendSms).
//   3. The call must have produced a summary AND been long enough to be
//      worth recapping (>= 30 seconds — quick hang-ups, wrong numbers,
//      and IVR bounces are not worth a text).
//
// This is fire-and-forget from the webhook's perspective: any failure is
// logged to Sentry but the webhook response stays 200 so Retell doesn't
// retry (which would spam the customer).
async function maybeSendPostCallSummary(
  supabase: SupabaseClient,
  call: NonNullable<RetellPayload["call"]>,
): Promise<void> {
  const fromNumber = call.from_number;
  const summary = (call.call_summary ?? "").trim();
  const durationSec = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0;

  if (!fromNumber || !summary) return;
  if (durationSec > 0 && durationSec < 30) return;

  // Find the store this call belongs to. We use to_number → stores, same
  // way search-inventory resolves the store, because the webhook already
  // validated the secret → store match (rows are inserted scoped).
  // Fetching via the call_logs entry we just wrote would work too, but
  // adds a round-trip and a race with the insert.
  const toNumber = call.to_number;
  if (!toNumber) return;

  const { data: storeData } = await supabase
    .from("stores")
    .select("id, name")
    .eq("retell_phone_number", toNumber)
    .maybeSingle();
  const store = storeData as { id: string; name: string } | null;
  if (!store) return;

  // Trim the Retell-generated summary to ~300 chars so the SMS fits
  // comfortably (staying under 4 iMessage segments). Retell's default
  // summary is usually 1–2 sentences already.
  const trimmed = summary.length > 300 ? `${summary.slice(0, 297)}…` : summary;
  const body = `Thanks for calling ${store.name}! ${trimmed}\n\nReply STOP to opt out.`;

  const result = await sendSms({
    supabase,
    storeId: store.id,
    toNumber: fromNumber,
    message: body,
    // Require consent: calling doesn't imply SMS opt-in, and A2P 10DLC
    // treats these as "informational" which still needs prior opt-in.
    requireConsent: true,
    purpose: "retell_call_summary",
  });

  if (!result.ok && result.reason !== "no_consent" && result.reason !== "store_not_configured" && result.reason !== "sendblue_not_configured") {
    // Legitimate failure path — surface to Sentry for triage. Silent
    // skips (no consent, no config) are expected and noisy.
    Sentry.captureMessage("retell post-call summary SMS failed", {
      level: "warning",
      tags: { route: "retell-webhook", store_id: store.id },
      extra: { reason: result.reason, detail: result.detail },
    });
  }
}

export async function POST(request: NextRequest) {
  let body: RetellPayload;
  try {
    body = (await request.json()) as RetellPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const secret =
    request.headers.get("x-webhook-secret") ?? body.secret ?? null;
  if (!secret) {
    return NextResponse.json({ error: "missing secret" }, { status: 401 });
  }

  const call = body.call;
  if (!call?.call_id) {
    return NextResponse.json({ error: "missing call.call_id" }, { status: 400 });
  }

  // Idempotency: Retell can redeliver the same event (call_started,
  // call_ended, call_analyzed) on timeout/retry. Dedupe by
  // (event, call_id) so we don't double-insert transcripts or summaries.
  const eventType = body.event ?? "unknown";
  const eventId = `${eventType}:${call.call_id}`;
  const claim = await checkAndClaim({
    provider: "retell",
    eventId,
    eventType,
  });
  if (claim === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("webhook_log_call", {
      p_secret: secret,
      p_retell_call_id: call.call_id,
      p_from_number: call.from_number ?? null,
      p_to_number: call.to_number ?? null,
      p_direction: "inbound",
      p_status: call.call_status ?? body.event ?? null,
      p_duration_sec: call.duration_ms
        ? Math.round(call.duration_ms / 1000)
        : null,
      p_transcript: call.transcript ?? null,
      p_summary: call.call_summary ?? null,
      p_recording_url: call.recording_url ?? null,
      p_metadata: { event: body.event ?? null },
      p_started_at: toIso(call.start_timestamp),
      p_ended_at: toIso(call.end_timestamp),
    });

    if (error) {
      await markFailed("retell", eventId, error.message);
      console.error("retell webhook error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await markHandled("retell", eventId);

    // Fire-and-forget post-call SMS summary. Only runs for the analysis
    // event — that's when call_summary is populated. Any other event
    // (call_started, call_ended with no summary yet) is a silent no-op
    // inside the helper. Never block the webhook response: Retell will
    // retry on non-200, which could spam the customer.
    if (body.event === "call_analyzed" && call.call_summary) {
      void maybeSendPostCallSummary(supabase, call).catch((e) => {
        Sentry.captureException(e, {
          tags: { route: "retell-webhook", step: "post_call_sms" },
        });
      });
    }

    return NextResponse.json({ ok: true, call_log_id: data });
  } catch (e) {
    const msg = (e as Error)?.message ?? "unknown";
    await markFailed("retell", eventId, msg);
    Sentry.captureException(e, {
      tags: { webhook: "retell", event_type: eventType },
      extra: { event_id: eventId },
    });
    console.error("retell webhook handler error:", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

// Retell pings with GET for health check
export async function GET() {
  return NextResponse.json({ status: "ready", service: "retell-webhook" });
}
