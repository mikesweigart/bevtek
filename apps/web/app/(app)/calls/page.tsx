import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

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

  type StoreBits = { retell_webhook_secret?: string | null; phone?: string | null };
  let s: StoreBits | null = null;
  let migrationMissing = false;
  const storeQ = await supabase
    .from("stores")
    .select("retell_webhook_secret, phone")
    .eq("id", p!.store_id!)
    .maybeSingle();
  if (storeQ.error) {
    migrationMissing = true;
    const fb = await supabase
      .from("stores")
      .select("phone")
      .eq("id", p!.store_id!)
      .maybeSingle();
    s = (fb.data as StoreBits | null) ?? null;
  } else {
    s = (storeQ.data as StoreBits | null) ?? null;
  }
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
          Inbound phone calls answered by Gabby, 24/7. Every call becomes a
          transcript, summary, and follow-up in your dashboard.
        </p>
      </div>

      {/* Orientation block — always visible so owners understand what's
          about to happen before they email activation. */}
      <section className="grid gap-4 sm:grid-cols-3">
        <HowItWorksCard
          step="1"
          title="You send us your number"
          body="Your store phone, your hours, any scripts you want Gabby to follow."
        />
        <HowItWorksCard
          step="2"
          title="We forward it to Gabby"
          body="No new hardware. No porting. Your existing line keeps working — Gabby just picks up when you can't."
        />
        <HowItWorksCard
          step="3"
          title="Every call lands here"
          body="Transcript, caller intent, and an iMessage summary sent to the shopper. You walk in tomorrow and know exactly what happened."
        />
      </section>

      {migrationMissing && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          Run migration 8 (webhook_rpc) in the Supabase SQL Editor to enable
          Receptionist activation.
        </div>
      )}

      {calls.length === 0 && !migrationMissing && (
        <section className="rounded-2xl border-2 border-[color:var(--color-gold)] bg-gradient-to-br from-white to-[#FBF7F0] p-8 space-y-5">
          <div className="space-y-2">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Done for you
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              We&apos;ll set up Gabby Receptionist for you.
            </h2>
            <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
              Gabby Receptionist is included with your plan. We handle every
              piece of the technical setup — the AI voice agent, the phone
              number routing, the integrations — so you don&apos;t have to touch
              a single third-party service.
            </p>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-white p-5 space-y-3">
            <p className="text-sm font-medium">To activate, send us:</p>
            <ul className="space-y-1.5 text-sm text-[color:var(--color-muted)]">
              <li className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">•</span>
                <span>Your store phone number</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">•</span>
                <span>Your regular business hours</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">•</span>
                <span>Anything you want Megan to specifically say or ask</span>
              </li>
            </ul>
            <a
              href="mailto:activate@bevtek.ai?subject=Activate%20Megan%20Receptionist&body=Store%20phone%20number%3A%20%0ABusiness%20hours%3A%20%0ASpecial%20instructions%3A%20"
              className="inline-flex items-center justify-center rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
            >
              Email activation request
            </a>
            <p className="text-xs text-[color:var(--color-muted)]">
              Turnaround: 24 hours. No setup fee beyond what&apos;s already in
              your plan.
            </p>
          </div>
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
        </>
      )}
    </div>
  );
}

function HowItWorksCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-5 space-y-2">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[color:var(--color-gold)] text-white text-xs font-bold">
        {step}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-[color:var(--color-muted)] leading-relaxed">
        {body}
      </p>
    </div>
  );
}
