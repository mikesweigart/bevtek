// Webhook idempotency helper.
//
// Usage:
//   const result = await checkAndClaim({
//     provider: "stripe",
//     eventId: event.id,
//     eventType: event.type,
//   });
//   if (result === "duplicate") return NextResponse.json({ received: true, duplicate: true });
//   try {
//     await handleEvent(event);
//     await markHandled(provider, event.id);
//   } catch (e) {
//     await markFailed(provider, event.id, (e as Error).message);
//     throw e;
//   }
//
// Fail mode: if the ledger write itself fails (Supabase down, table
// missing), we LOG and return "fresh" — we'd rather process a possibly
// duplicate event than drop a live one. Providers retry, so a genuine
// duplicate will hit again and get caught once the ledger is back.

import { createClient } from "@supabase/supabase-js";

type Provider = "stripe" | "retell" | "sendblue";

type ClaimResult = "fresh" | "duplicate" | "ledger-unavailable";

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Attempt to claim this event. Returns:
 *   - "fresh" if we inserted the row (the caller should process it),
 *   - "duplicate" if the row already existed (caller should short-circuit),
 *   - "ledger-unavailable" if the insert failed for any other reason
 *     (caller should log + proceed — at-least-once is safer than
 *     accidentally dropping a genuine event).
 */
export async function checkAndClaim(opts: {
  provider: Provider;
  eventId: string;
  eventType?: string | null;
}): Promise<ClaimResult> {
  const client = svc();
  if (!client) return "ledger-unavailable";

  const { error } = await client
    .from("webhook_events")
    .insert({
      provider: opts.provider,
      event_id: opts.eventId,
      event_type: opts.eventType ?? null,
    });
  if (!error) return "fresh";

  // Postgres unique-violation → already-processed. Every other error
  // is a ledger availability issue.
  const code = (error as { code?: string }).code;
  if (code === "23505") return "duplicate";

  // eslint-disable-next-line no-console
  console.warn(
    "[webhook.idempotency] ledger insert failed",
    JSON.stringify({ provider: opts.provider, event_id: opts.eventId, err: error.message }),
  );
  return "ledger-unavailable";
}

export async function markHandled(provider: Provider, eventId: string): Promise<void> {
  const client = svc();
  if (!client) return;
  await client
    .from("webhook_events")
    .update({ handled: true, handled_at: new Date().toISOString(), handle_error: null })
    .eq("provider", provider)
    .eq("event_id", eventId);
}

export async function markFailed(
  provider: Provider,
  eventId: string,
  error: string,
): Promise<void> {
  const client = svc();
  if (!client) return;
  await client
    .from("webhook_events")
    .update({
      handled: false,
      handled_at: new Date().toISOString(),
      handle_error: error.slice(0, 1000),
    })
    .eq("provider", provider)
    .eq("event_id", eventId);
}
