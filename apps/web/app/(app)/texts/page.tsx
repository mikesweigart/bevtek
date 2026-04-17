import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

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
          Two-way iMessage (blue bubble) with your customers — sent and
          received from your dedicated business line.
        </p>
      </div>

      {/* A2P transparency block — owners need to know texting takes a few
          weeks of approval but everything else works in the meantime. */}
      <section className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 space-y-4">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-gold)] font-semibold">
              Important — A2P 10DLC
            </p>
            <h2 className="text-xl font-semibold tracking-tight mt-1">
              Two to three week approval window
            </h2>
          </div>
          <span className="text-[11px] bg-amber-100 text-amber-800 rounded-full px-2.5 py-1 font-medium">
            Regulatory requirement
          </span>
        </div>
        <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
          Every business that texts customers in the US has to go through a
          one-time compliance registration called A2P 10DLC. This protects
          shoppers from spam and keeps carriers from blocking your messages.
          The good news: once you&rsquo;re approved, you have the highest
          deliverability rate in the industry, and you never have to do it
          again.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 pt-1">
          <TimelineStep
            n="1"
            title="You start the application"
            body="~15 minutes. EIN, brand info, sample messages. We pre-fill 90% from your account."
          />
          <TimelineStep
            n="2"
            title="Carriers approve"
            body="Takes 7–21 days. We run behind the scenes, no action needed from you."
          />
          <TimelineStep
            n="3"
            title="Gabby goes live"
            body="Your dedicated number activates automatically the moment approval lands."
          />
        </div>
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <a
            href="mailto:activate@bevtek.ai?subject=Start%20A2P%20application"
            className="inline-flex items-center rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
          >
            Start A2P application
          </a>
          <p className="text-xs text-[color:var(--color-muted)]">
            Everything else in BevTek keeps running while approval is
            pending. You&rsquo;re not blocked.
          </p>
        </div>
      </section>

      {migrationMissing && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          Run migration 8 (webhook_rpc) in the Supabase SQL Editor to enable
          Texting activation.
        </div>
      )}

      {consent.length === 0 && !migrationMissing && (
        <section className="rounded-2xl border-2 border-[color:var(--color-gold)] bg-gradient-to-br from-white to-[#FBF7F0] p-8 space-y-5">
          <div className="space-y-2">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Done for you
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              We&apos;ll get your iMessage number live.
            </h2>
            <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
              Texting is part of your plan (Pro and Elite, or as the SMS
              follow-ups add-on on Starter). We provision the number, wire up
              the integrations, and handle TCPA-compliant opt-in/opt-out — you
              just text your customers.
            </p>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-white p-5 space-y-3">
            <p className="text-sm font-medium">To activate, tell us:</p>
            <ul className="space-y-1.5 text-sm text-[color:var(--color-muted)]">
              <li className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">•</span>
                <span>What area code you want (we provision a dedicated iMessage number)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">•</span>
                <span>What kinds of messages you want to send (order confirmations, back-in-stock alerts, recommendations)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">•</span>
                <span>Your existing customer list (optional — we&apos;ll import it with opt-in records)</span>
              </li>
            </ul>
            <a
              href="mailto:activate@bevtek.ai?subject=Activate%20Megan%20Texting&body=Desired%20area%20code%3A%20%0AWhat%20we%20want%20to%20send%3A%20%0AExisting%20customer%20list%3F%20"
              className="inline-flex items-center justify-center rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
            >
              Email activation request
            </a>
            <p className="text-xs text-[color:var(--color-muted)]">
              Turnaround: 24–48 hours. TCPA compliance handled for you.
            </p>
          </div>
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

        </>
      )}
    </div>
  );
}

function TimelineStep({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] p-4 space-y-1.5">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[color:var(--color-gold)] text-white text-xs font-bold">
        {n}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-[color:var(--color-muted)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}
