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
  commission_rate: number;
  payout_email: string | null;
  status: string;
};

export default async function AffiliateDashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/affiliates/login");

  const { data: affiliateData, error } = await supabase
    .from("affiliates")
    .select(
      "id, email, full_name, referral_code, commission_rate, payout_email, status",
    )
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !affiliateData) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            No affiliate account found
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            {error?.message ??
              "This login doesn't have an affiliate record. Apply to the program first."}
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

  const affiliate = affiliateData as Affiliate;

  // Clicks and conversions — counts for the top-line stats.
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
                Your account is active ·{" "}
                {Math.round(affiliate.commission_rate * 100)}% recurring
                commission
              </>
            ) : (
              <>Status: {affiliate.status}</>
            )}
          </p>
        </div>

        {/* Your referral link */}
        <ReferralLinkCard link={referralLink} />

        {/* Stats */}
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Clicks" value={clicks} />
          <Stat label="Sign-ups" value={conversions} />
          <Stat
            label="Conversion rate"
            value={
              clicks > 0
                ? `${Math.round((conversions / clicks) * 100)}%`
                : "—"
            }
          />
        </section>

        {/* Getting started */}
        <section className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Ways to share your link
          </h2>
          <ul className="space-y-2 text-sm">
            {[
              "Reach out to 5 liquor store owners you know personally this week.",
              "Post in industry Slack/Discord groups (e.g. r/liquorstore, Beverage Retail Forum).",
              "Add it to your email signature and LinkedIn bio.",
              "Pitch it to distributors as a value-add for their customers.",
            ].map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">
                  •
                </span>
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

function ReferralLinkCard({ link }: { link: string }) {
  return (
    <section className="rounded-xl border-2 border-[color:var(--color-gold)] bg-gradient-to-br from-white to-[#FBF7F0] p-6 space-y-3">
      <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
        Your referral link
      </h2>
      <CopyRow value={link} />
      <p className="text-xs text-[color:var(--color-muted)]">
        Every signup through this link is credited to you for 90 days. Even if
        they sign up later, if their browser saw your link, you get the
        commission.
      </p>
    </section>
  );
}

