// BevTek-internal admin gate. No "admin" row in the database — we check
// the authenticated user's email against the BEVTEK_ADMIN_EMAILS env var
// (comma-separated). Keeps one-person-ops simple and avoids adding an
// admin concept to the users table that would confuse the RLS policies.
//
// Server-action and page callers read this helper; if it returns false
// they 404 (not 403) so the admin surface isn't even discoverable.

import type { SupabaseClient } from "@supabase/supabase-js";

function adminEmails(): Set<string> {
  const raw = process.env.BEVTEK_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function hasAdminEnvConfigured(): boolean {
  return adminEmails().size > 0;
}

export async function isBevTekAdmin(
  supabase: SupabaseClient,
): Promise<{ ok: boolean; email: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email?.toLowerCase() ?? null;
  if (!email) return { ok: false, email: null };
  return { ok: adminEmails().has(email), email };
}
