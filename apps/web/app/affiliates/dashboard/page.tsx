import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CopyRow } from "./CopyRow";

type Affiliate = {
  id: string;
  email: string;
  full_name: string | null;
  referral_code: string;
  discount_code: string | null;
  commission_rate: number;
  customer_discount_rate: number | null;
  payout_email: string | null;
  status: string;
};

export default async function AffiliateDashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/affiliates/login");

  // Try full query first; fall back if migration 10 hasn't run yet.
  let affiliate: Affiliate | null = null;
  let migrationMissing = false;

  const full = await supabase
    .from("affiliates")
    .select(
      "id, email, full_name, referral_code, discount_code, commission_rate, customer_discount_rate, payout_email, status",
    )
    .eq("id", auth.user.id)
    .maybeSingle();

  if (full.error) {
    migrationMissing = true;
    const fb = await supabase
      .from("affiliates")
      .select(
        "id, email, full_name, referral_code, commission_rate, payout_email, status",
      )
      .eq("id", auth.user.id)
      .maybeSingle();
    if (fb.data) {
      affiliate = {
        ...(fb.data as Omit<Affiliate, "discount_code" | "customer_discount_rate">),
        discount_code: null,
        customer_discount_rate: null,
      };
    }
  } else {
    affiliate = (full.data as Affiliate | null) ?? null;
  }

  if (!affiliate) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            No affiliate account found
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            This login doesn&apos;t have an affiliate record yet.
          </p>
          <Link
            href="/affiliates/signup"
            className="inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)]"
          >
            Apply
          </Link>
        </div>
      </div>
    );
  }

  const [clicksRes, conversionsRes] = await Promise.all([
    supabase
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("referral_code", affiliate.referral_code),
    supabase
      .from("affiliate_conversions")
      .select("*", { count: "exact", head: true })
      .eq("referral_code", affiliate.referral_code),
  ]);

  const clicks = clicksRes.count ?? 0;
  const conversions = conversionsRes.count ?? 0;

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;
  const referralLink = `${origin}/?ref=${affiliate.referral_code}`;
  const signupLinkWithCode = affiliate.discount_code
    ? `${origin}/signup?code=${affiliate.discount_code}`
    : null;

  const discountPct = affiliate.customer_discount_rate
    ? Math.round(affiliate.customer_discount_rate * 100)
    : 10;
  const commissionPct = Math.round((affiliate.commission_rate ?? 0.15) * 100);

  return (
    <div className="flex-1">
      <header className="border-b border-[color:var(--color-border)]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/affiliates" className="text-sm font-semibold tracking-tight">
            BevTek<span className="text-[color:var(--color-gold)]">.ai</span>{" "}
            <span className="text-[color:var(--color-muted)] font-normal">
              · Affiliates
            </span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <span className="text-[color:var(--color-muted)]">
              {affiliate.full_name ?? affiliate.email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome{affiliate.full_name ? `, ${affiliate.full_name}` : ""}.
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            {affiliate.status === "active" ? (
              <>
                Your account is active · You give {discountPct}% off · You earn{" "}
                {commissionPct}% recurring commission
              </>
            ) : (
              <>Status: {affiliate.status}</>
            )}
          </p>
        </div>

        {migrationMissing && (
          <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
            Run migration 10 (affiliate_discount_code) in the Supabase SQL
            Editor to enable your discount code.
          </div>
        )}

        {/* Discount code card — primary */}
        {affiliate.discount_code && (
          <section className="rounded-xl border-2 border-[color:var(--color-gold)] bg-gradient-to-br from-white to-[#FBF7F0] p-6 space-y-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
                  Your discount code
                </h2>
                <p className="text-xs text-[color:var(--color-muted)] mt-0.5">
                  Stores who redeem this save {discountPct}% · You earn{" "}
                  {commissionPct}% forever.
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-[color:var(--color-gold)] text-white font-semibold whitespace-nowrap">
                {discountPct}% off → {commissionPct}% to you
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg bg-white border-2 border-dashed border-[color:var(--color-gold)] p-4 text-center">
                <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
                  Code
                </p>
                <p className="text-3xl font-semibold font-mono tracking-wider text-[color:var(--color-gold)] mt-1">
                  {affiliate.discount_code}
                </p>
              </div>
            </div>
            {signupLinkWithCode && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[color:var(--color-muted)]">
                  Or share a prefilled signup link (code auto-applied):
                </p>
                <CopyRow value={signupLinkWithCode} />
              </div>
            )}
          </section>
        )}

        {/* Referral link — secondary */}
        <section className="rounded-xl border border-[color:var(--color-border)] bg-white p-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Referral link (alternative)
          </h2>
          <p className="text-xs text-[color:var(--color-muted)]">
            Stores who click this link are credited to you for 90 days even if
            they don&apos;t use the discount code.
          </p>
          <CopyRow value={referralLink} />
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Clicks" value={clicks} />
          <Stat label="Sign-ups" value={conversions} />
          <Stat
            label="Conversion rate"
            value={clicks > 0 ? `${Math.round((conversions / clicks) * 100)}%` : "—"}
          />
        </section>

        <section className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Ways to share
          </h2>
          <ul className="space-y-2 text-sm">
            {[
              `Text your code "${affiliate.discount_code ?? "YOURCODE"}" to 5 liquor store owners you know — "Try BevTek, use my code for 10% off."`,
              "Add the code to your email signature and LinkedIn bio.",
              "Pitch it to distributors as a free value-add for the stores they serve.",
              "Drop the signup link (with code baked in) in industry Slack/Discord groups.",
            ].map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">•</span>
                <span className="text-[color:var(--color-muted)]">{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Payouts
          </h2>
          <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
            Stripe Connect setup is coming soon. Once enabled, we&apos;ll email
            you a secure link to connect your bank account. Payouts run on the
            1st of every month with a 30-day clearing window.
          </p>
          <p className="text-xs text-[color:var(--color-muted)]">
            Payout email on file:{" "}
            <code className="px-1 bg-zinc-100 rounded">
              {affiliate.payout_email ?? affiliate.email}
            </code>
          </p>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] p-5">
      <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
        {label}
      </p>
      <p className="text-3xl font-semibold mt-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
