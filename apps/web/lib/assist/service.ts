// Thin service-role client for the assist_sessions table.
//
// The table is guarded by RLS for the authenticated employee path, but
// the PUBLIC continuation page a customer lands on after scanning the
// QR has no auth — the session id IS the capability. We use the
// service role here so that public route can read and append without
// needing an anon SELECT policy that would also expose listing.

import { createClient } from "@supabase/supabase-js";

export type AssistMessage = { role: "user" | "assistant"; content: string };

export type AssistSession = {
  id: string;
  store_id: string;
  employee_id: string | null;
  messages: AssistMessage[];
  status: "active" | "handed_off" | "expired" | "ended";
  created_at: string;
  handed_off_at: string | null;
  last_activity: string;
  expires_at: string;
};

export function getAssistServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Load a session by id, enforcing TTL. Returns null when the session
 * is missing, expired, or has been explicitly ended. Also flips the
 * status to "expired" on first read past the TTL so future callers
 * see a consistent shape.
 */
export async function loadLiveSession(
  id: string,
): Promise<AssistSession | null> {
  const svc = getAssistServiceClient();
  if (!svc) return null;

  const { data, error } = await svc
    .from("assist_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const s = data as AssistSession;
  if (s.status === "expired" || s.status === "ended") return null;
  if (new Date(s.expires_at).getTime() <= Date.now()) {
    await svc.from("assist_sessions").update({ status: "expired" }).eq("id", id);
    return null;
  }
  return s;
}
