// Audit-log helper.
//
// Usage (from a server action / route handler):
//
//   import { logAudit } from "@/lib/audit/log";
//   await logAudit({
//     action: "support.ticket.status_update",
//     actor: { id: user.id, email: user.email },
//     storeId,
//     target: { type: "ticket", id: ticketId },
//     metadata: { from: prevStatus, to: nextStatus },
//   });
//
// Fail mode: this helper NEVER throws. If the insert fails (Supabase
// down, table missing, bad payload), we log a warning and return. An
// audit write failing must never roll back the underlying action —
// that would make the audit system itself a denial-of-service vector.
// We accept the tradeoff that during a Supabase outage we may lose
// audit rows; the action itself is more important to complete.
//
// Never put raw request bodies, tokens, or PII freeform fields in
// `metadata`. Record the shape of the change (field names, booleans,
// before/after IDs) — not the contents.

import { createClient } from "@supabase/supabase-js";

type Actor = {
  id?: string | null;
  email?: string | null;
};

type Target = {
  type: string;
  id: string | number;
};

export type AuditEvent = {
  action: string;
  actor?: Actor | null;
  storeId?: string | null;
  target?: Target | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    const client = svc();
    if (!client) {
      // eslint-disable-next-line no-console
      console.warn("[audit] service-role client unavailable; skipping", {
        action: event.action,
      });
      return;
    }

    const { error } = await client.from("audit_events").insert({
      actor_id: event.actor?.id ?? null,
      actor_email: event.actor?.email ?? null,
      store_id: event.storeId ?? null,
      action: event.action,
      target_type: event.target?.type ?? null,
      target_id:
        event.target?.id !== undefined && event.target?.id !== null
          ? String(event.target.id)
          : null,
      metadata: event.metadata ?? {},
      ip: event.ip ?? null,
      user_agent: event.userAgent ?? null,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.warn(
        "[audit] insert failed",
        JSON.stringify({ action: event.action, err: error.message }),
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[audit] helper threw", (e as Error)?.message ?? e);
  }
}
