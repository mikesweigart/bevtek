import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  checkAndClaim,
  markFailed,
  markHandled,
} from "@/lib/webhooks/idempotency";

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
