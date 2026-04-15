import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { RotateSecretButton } from "./RotateSecretButton";

type CallLog = {
  id: string;
  retell_call_id: string | null;
  from_number: string | null;
  to_number: string | null;
  status: string | null;
  duration_sec: number | null;
  summary: string | null;
  started_at: string | null;
  created_at: string;
};

function fmtDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtPhone(n: string | null): string {
  if (!n) return "—";
  const digits = n.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return n;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default async function CallsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role, store_id")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const p = profile as { role?: string; store_id?: string } | null;
  const isOwner = p?.role === "owner";

  const { data: store } = await supabase
    .from("stores")
    .select("retell_webhook_secret, phone")
    .eq("id", p!.store_id!)
    .maybeSingle();
  const s = store as
    | { retell_webhook_secret?: string | null; phone?: string | null }
    | null;
  const hasSecret = Boolean(s?.retell_webhook_secret);

  const { data: callsData } = await supabase
    .from("call_logs")
    .select(
      "id, retell_call_id, from_number, to_number, status, duration_sec, summary, started_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  const calls = (callsData as CallLog[] | null) ?? [];

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;
  const webhookUrl = `${origin}/api/retell/webhook`;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receptionist</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Inbound phone calls answered by Megan via Retell AI.
        </p>
      </div>

      {calls.length === 0 && (
        <section className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${hasSecret ? "bg-amber-500" : "bg-zinc-300"}`}
            />
            <h2 className="text-sm font-semibold">
              {hasSecret
                ? "Webhook ready · waiting for your first call"
                : "Connect Retell AI"}
            </h2>
          </div>
          <ol className="space-y-3 text-sm text-[color:var(--color-muted)] list-decimal list-inside">
            <li>
              Create a Retell AI account at{" "}
              <a
                href="https://retellai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--color-gold)] underline"
              >
                retellai.com
              </a>{" "}
              and build a voice agent for your store.
            </li>
            <li>
              In Retell, go to your agent&apos;s <b>Webhook</b> settings and
              paste the URL + secret below. Retell sends an event when a call
              starts and ends — we log them here.
            </li>
            <li>
              Point your store phone number&apos;s incoming calls to your Retell
              agent (Retell walks you through this).
            </li>
            <li>Call the number. Watch this page.</li>
          </ol>

          {isOwner ? (
            <RotateSecretButton
              webhookUrl={webhookUrl}
              initialSecret={s?.retell_webhook_secret ?? null}
            />
          ) : (
            <p className="text-xs text-[color:var(--color-muted)]">
              Only the store owner can view or rotate the webhook secret. Ask
              them to set it up.
            </p>
          )}
        </section>
      )}

      {calls.length > 0 && (
        <>
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">From</th>
                  <th className="text-left px-4 py-2 font-medium">When</th>
                  <th className="text-right px-4 py-2 font-medium">Duration</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-[color:var(--color-border)]"
                  >
                    <td className="px-4 py-2 font-medium">
                      {fmtPhone(c.from_number)}
                    </td>
                    <td className="px-4 py-2 text-[color:var(--color-muted)]">
                      {relativeTime(c.started_at ?? c.created_at)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {fmtDuration(c.duration_sec)}
                    </td>
                    <td className="px-4 py-2 text-xs">{c.status ?? "—"}</td>
                    <td className="px-4 py-2 text-[color:var(--color-muted)] truncate max-w-xs">
                      {c.summary ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isOwner && (
            <details className="text-sm">
              <summary className="cursor-pointer text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]">
                Webhook configuration
              </summary>
              <div className="mt-4 rounded-lg border border-[color:var(--color-border)] p-4">
                <RotateSecretButton
                  webhookUrl={webhookUrl}
                  initialSecret={s?.retell_webhook_secret ?? null}
                />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
