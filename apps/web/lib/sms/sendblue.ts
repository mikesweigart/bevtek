// Sendblue outbound SMS/iMessage wrapper.
//
// WHAT THIS IS
//   A small, opinionated Sendblue client that the rest of the app uses to
//   actually send a message. We deliberately keep the external surface
//   tiny — one function, `sendSms`. That keeps all consent gating, phone
//   normalization, and store-scoped from-number lookup in ONE place, so a
//   new caller (hold ready-for-pickup, Retell post-call summary, promo
//   blast) can't forget a step and accidentally text a customer who
//   opted out.
//
// WHY IT'S HERE (not lib/webhooks or lib/email)
//   Sendblue is both an inbound and outbound channel. The webhook path
//   (lib/webhooks + /api/sendblue/webhook) only handles inbound events —
//   consent, replies. This module handles outbound, which has an entirely
//   different concern set (API auth, budget, consent gating). Keeping them
//   separate means a bug in the send path can't brick the receive path.
//
// AUTH
//   Sendblue uses two headers for API auth:
//     SB-API-KEY-ID
//     SB-API-SECRET-KEY
//   Both live in env. They are ACCOUNT-level (not per-store), because
//   Sendblue's model is "one account, many numbers, one pool of credit."
//   The per-STORE from_number is kept on stores.sendblue_number and looked
//   up on every send.
//
// CONSENT
//   Every send checks sms_consent for (store_id, phone_number). If the
//   row says consented=false OR revoked_at IS NOT NULL, we refuse. If
//   there's no row at all, the default is "do NOT send" — SMS compliance
//   (A2P 10DLC, TCPA) requires opt-in BEFORE the first marketing/promo
//   message. Transactional messages (e.g. hold ready-for-pickup) can
//   bypass this via `requireConsent: false` at the caller's discretion.
//
// RETURN SHAPE
//   { ok: true, messageHandle } on success
//   { ok: false, reason } on any kind of block (missing config, no
//   consent, bad phone, Sendblue error)
//   We never throw — the caller is always some user-visible action
//   (staff click, cron job) and should degrade gracefully. Sentry
//   captures failures for triage.

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

const SENDBLUE_ENDPOINT = "https://api.sendblue.co/api/send-message";

export type SendSmsArgs = {
  /**
   * Any authed Supabase client (cookie-based or service-role). The caller
   * is responsible for having already verified the invoking user has
   * permission to send on behalf of `storeId`.
   */
  supabase: SupabaseClient;
  storeId: string;
  /** Recipient phone. E.164 preferred, but we'll normalize common formats. */
  toNumber: string;
  message: string;
  /**
   * Default true: refuse to send unless sms_consent shows an active opt-in
   * for this (store, phone). Transactional-only callers (hold ready, call
   * summary) may set false with a human-written justification.
   */
  requireConsent?: boolean;
  /** Free-form tag for logs / Sentry / future reporting. */
  purpose?: string;
};

export type SendSmsResult =
  | { ok: true; messageHandle: string | null; from: string; to: string }
  | {
      ok: false;
      reason:
        | "sendblue_not_configured"
        | "store_not_configured"
        | "bad_recipient"
        | "no_consent"
        | "empty_message"
        | "sendblue_error";
      detail?: string;
    };

/**
 * Normalize a user-entered phone to E.164 (+1XXXXXXXXXX for US).
 * Returns null if we can't confidently produce a valid number. We don't
 * try to handle every international format here — if a store pastes
 * "+44 20 7123 4567" it already has the +, so it passes through.
 */
export function normalizePhoneE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Already E.164-ish: trust it if there's a leading + and 8–15 digits.
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * Check sms_consent for an active opt-in on (store, phone). Returns true
 * only if a row exists with consented=true AND revoked_at IS NULL. Errors
 * fail closed — we'd rather drop a transactional message than accidentally
 * spam an opted-out number.
 */
async function hasActiveConsent(
  supabase: SupabaseClient,
  storeId: string,
  phoneE164: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sms_consent")
    .select("consented, revoked_at")
    .eq("store_id", storeId)
    .eq("phone_number", phoneE164)
    .maybeSingle();
  if (error) return false;
  const row = data as { consented: boolean; revoked_at: string | null } | null;
  if (!row) return false;
  return row.consented && !row.revoked_at;
}

/**
 * Fire a single SMS/iMessage via Sendblue. Never throws — returns a
 * tagged-union result so callers can branch on failure reasons without
 * a try/catch.
 */
export async function sendSms(args: SendSmsArgs): Promise<SendSmsResult> {
  const keyId = process.env.SENDBLUE_API_KEY_ID;
  const keySecret = process.env.SENDBLUE_API_SECRET_KEY;
  if (!keyId || !keySecret) {
    return { ok: false, reason: "sendblue_not_configured" };
  }

  const content = args.message.trim();
  if (!content) return { ok: false, reason: "empty_message" };

  const to = normalizePhoneE164(args.toNumber);
  if (!to) return { ok: false, reason: "bad_recipient" };

  // Store-scoped from-number. We never fall back to an account-default
  // line — that would cross-contaminate opt-in state between tenants.
  const { data: storeData } = await args.supabase
    .from("stores")
    .select("sendblue_number")
    .eq("id", args.storeId)
    .maybeSingle();
  const store = storeData as { sendblue_number: string | null } | null;
  const from = store?.sendblue_number ? normalizePhoneE164(store.sendblue_number) : null;
  if (!from) {
    return { ok: false, reason: "store_not_configured" };
  }

  const requireConsent = args.requireConsent ?? true;
  if (requireConsent) {
    const ok = await hasActiveConsent(args.supabase, args.storeId, to);
    if (!ok) return { ok: false, reason: "no_consent" };
  }

  try {
    const res = await fetch(SENDBLUE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "SB-API-KEY-ID": keyId,
        "SB-API-SECRET-KEY": keySecret,
      },
      body: JSON.stringify({
        number: to,
        from_number: from,
        content,
      }),
      // Sendblue normally responds in <1s; cap at 10s so a flaky send
      // doesn't hold a server action open and time out the client.
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await res.json().catch(() => null)) as
      | { status?: string; message_handle?: string; error_code?: string; error_message?: string }
      | null;

    if (!res.ok || (payload?.status && /fail|error/i.test(payload.status))) {
      const detail =
        payload?.error_message ?? payload?.error_code ?? `HTTP ${res.status}`;
      Sentry.captureMessage("sendblue send failed", {
        level: "warning",
        tags: { route: "lib/sms", store_id: args.storeId, purpose: args.purpose ?? "unknown" },
        extra: { detail, to, from },
      });
      return { ok: false, reason: "sendblue_error", detail };
    }

    return {
      ok: true,
      messageHandle: payload?.message_handle ?? null,
      from,
      to,
    };
  } catch (e) {
    const detail = (e as Error)?.message ?? "unknown";
    Sentry.captureException(e, {
      tags: { route: "lib/sms", store_id: args.storeId, purpose: args.purpose ?? "unknown" },
      extra: { to, from },
    });
    return { ok: false, reason: "sendblue_error", detail };
  }
}

/**
 * Convenience boolean for health checks / settings UI ("is outbound SMS
 * ready?"). Does NOT verify per-store configuration — only that the
 * account-level API credentials are present.
 */
export function isSendblueConfigured(): boolean {
  return Boolean(process.env.SENDBLUE_API_KEY_ID && process.env.SENDBLUE_API_SECRET_KEY);
}
