import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { RotateSecretButton } from "./RotateSecretButton";

type ConsentRow = {
  id: string;
  phone_number: string;
  consented: boolean;
  source: string | null;
  consented_at: string;
  revoked_at: string | null;
};

function fmtPhone(n: string): string {
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

export default async function TextsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role, store_id")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const p = profile as { role?: string; store_id?: string } | null;
  const isOwner = p?.role === "owner";

  type StoreBits = {
    sendblue_webhook_secret?: string | null;
    sendblue_number?: string | null;
  };
  let s: StoreBits | null = null;
  let migrationMissing = false;
  const storeQ = await supabase
    .from("stores")
    .select("sendblue_webhook_secret, sendblue_number")
    .eq("id", p!.store_id!)
    .maybeSingle();
  if (storeQ.error) {
    migrationMissing = true;
  } else {
    s = (storeQ.data as StoreBits | null) ?? null;
  }
  const hasSecret = Boolean(s?.sendblue_webhook_secret);

  const { data: consentData } = await supabase
    .from("sms_consent")
    .select("id, phone_number, consented, source, consented_at, revoked_at")
    .order("consented_at", { ascending: false })
    .limit(50);
  const consent = (consentData as ConsentRow[] | null) ?? [];

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;
  const webhookUrl = `${origin}/api/sendblue/webhook`;

  const opted = consent.filter((c) => c.consented && !c.revoked_at).length;
  const revoked = consent.filter((c) => !c.consented || c.revoked_at).length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Texting</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          iMessage conversations with your customers via Sendblue.
        </p>
      </div>

      {migrationMissing && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          Run migration 8 (webhook_rpc) in the Supabase SQL Editor to enable
          Texting setup.
        </div>
      )}

      {consent.length === 0 && !migrationMissing && (
        <section className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${hasSecret ? "bg-amber-500" : "bg-zinc-300"}`}
            />
            <h2 className="text-sm font-semibold">
              {hasSecret
                ? "Webhook ready · waiting for your first conversation"
                : "Connect Sendblue"}
            </h2>
          </div>
          <ol className="space-y-3 text-sm text-[color:var(--color-muted)] list-decimal list-inside">
            <li>
              Create a Sendblue account at{" "}
              <a
                href="https://sendblue.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--color-gold)] underline"
              >
                sendblue.co
              </a>{" "}
              and claim an iMessage number.
            </li>
            <li>
              In Sendblue, go to <b>Developers → Webhooks</b> and paste the URL
              + secret below.
            </li>
            <li>
              We&apos;ll track opt-in / opt-out events here. Full two-way
              conversation UI is on the roadmap.
            </li>
          </ol>

          {isOwner ? (
            <RotateSecretButton
              webhookUrl={webhookUrl}
              initialSecret={s?.sendblue_webhook_secret ?? null}
            />
          ) : (
            <p className="text-xs text-[color:var(--color-muted)]">
              Only the store owner can view or rotate the webhook secret.
            </p>
          )}
        </section>
      )}

      {consent.length > 0 && (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[color:var(--color-border)] p-5">
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                Opted in
              </p>
              <p className="text-3xl font-semibold mt-1">
                {opted.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-5">
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                Opted out
              </p>
              <p className="text-3xl font-semibold mt-1">
                {revoked.toLocaleString()}
              </p>
            </div>
          </section>

          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Phone</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Source</th>
                  <th className="text-left px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {consent.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-[color:var(--color-border)]"
                  >
                    <td className="px-4 py-2 font-medium">
                      {fmtPhone(c.phone_number)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          c.consented && !c.revoked_at
                            ? "bg-green-50 text-green-800"
                            : "bg-red-50 text-red-800"
                        }`}
                      >
                        {c.consented && !c.revoked_at ? "Opted in" : "Opted out"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[color:var(--color-muted)] text-xs">
                      {c.source ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-[color:var(--color-muted)] text-xs">
                      {relativeTime(c.consented_at)}
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
                  initialSecret={s?.sendblue_webhook_secret ?? null}
                />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
