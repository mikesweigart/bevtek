import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program",
  description:
    "Earn 30% recurring commission for every store you refer to BevTek. Real-time dashboard, Stripe payouts.",
  openGraph: {
    title: "BevTek Affiliate Program",
    description:
      "Earn 30% recurring commission for every store you refer to BevTek.",
  },
};

export default function AffiliatesLanding() {
  return (
    <main className="flex-1">
      <header className="border-b border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            BevTek<span className="text-[color:var(--color-gold)]">.ai</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/affiliates/login"
              className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
            >
              Affiliate login
            </Link>
            <Link
              href="/affiliates/signup"
              className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium"
            >
              Apply
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-[color:var(--color-muted)] border border-[color:var(--color-border)] rounded-full px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
            Partner Program
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Refer a store.
            <br />
            Get paid{" "}
            <span className="text-[color:var(--color-gold)]">every month</span>.
          </h1>
          <p className="text-lg sm:text-xl text-[color:var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
            If you know beverage retail — distributors, POS consultants, store
            owners — you can turn that rolodex into monthly recurring income.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/affiliates/signup"
              className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] transition-colors"
            >
              Become an affiliate
            </Link>
            <Link
              href="/affiliates/login"
              className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] transition-colors"
            >
              Affiliate login
            </Link>
          </div>
        </div>
      </section>

      {/* The offer */}
      <section className="px-6 py-16 sm:py-20 bg-zinc-50 border-y border-[color:var(--color-border)]">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              The deal
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Simple math, generous terms.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                headline: "30%",
                title: "Recurring commission",
                body: "Paid on every dollar your referrals spend, every month they stay. No caps.",
              },
              {
                headline: "90 days",
                title: "Attribution cookie",
                body: "Your referral is credited even if they sign up three months later.",
              },
              {
                headline: "Stripe",
                title: "Automatic payouts",
                body: "Connect Stripe once. We deposit earnings the 1st of every month.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[color:var(--color-border)] bg-white p-6 space-y-2"
              >
                <p className="text-4xl font-semibold text-[color:var(--color-gold)]">
                  {item.headline}
                </p>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example earnings */}
      <section className="px-6 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              What it adds up to
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Do the napkin math.
            </h2>
            <p className="text-[color:var(--color-muted)]">
              Illustrative only — pricing locks in at launch.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { refs: "5 stores", monthly: "$150/mo", year: "$1,800/yr" },
              { refs: "25 stores", monthly: "$750/mo", year: "$9,000/yr" },
              { refs: "100 stores", monthly: "$3,000/mo", year: "$36,000/yr" },
            ].map((row) => (
              <div
                key={row.refs}
                className="rounded-xl border border-[color:var(--color-border)] p-6 text-center"
              >
                <p className="text-sm text-[color:var(--color-muted)]">
                  {row.refs}
                </p>
                <p className="text-2xl font-semibold mt-1">{row.monthly}</p>
                <p className="text-xs text-[color:var(--color-muted)] mt-1">
                  {row.year}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[color:var(--color-muted)] text-center">
            Assumes an estimated $100/mo average plan × 30% commission. Actual
            figures will vary with plan mix and retention.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 sm:py-20 bg-zinc-50 border-y border-[color:var(--color-border)]">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              How it works
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Four steps to your first payout.
            </h2>
          </div>
          <ol className="space-y-3">
            {[
              "Apply in 60 seconds. We review same day.",
              "Get your unique referral link (e.g. bevtek.ai/?ref=yourcode).",
              "Share it with stores, distributors, your newsletter, your YouTube bio — wherever makes sense.",
              "When they sign up and subscribe, your commission starts. Paid monthly via Stripe.",
            ].map((step, i) => (
              <li
                key={step}
                className="rounded-lg border border-[color:var(--color-border)] bg-white p-5 flex gap-4"
              >
                <span className="shrink-0 w-8 h-8 rounded-full bg-[color:var(--color-gold)] text-white flex items-center justify-center text-sm font-semibold">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight">
            Ready to get your link?
          </h2>
          <Link
            href="/affiliates/signup"
            className="inline-flex items-center justify-center rounded-md px-8 py-4 text-base font-semibold text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] transition-colors"
          >
            Apply now
          </Link>
          <p className="text-xs text-[color:var(--color-muted)]">
            Free · no contract · approved same day
          </p>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[color:var(--color-muted)]">
          <Link href="/" className="hover:text-[color:var(--color-fg)]">
            ← Back to BevTek
          </Link>
          <p>© {new Date().getFullYear()} BevTek.ai</p>
        </div>
      </footer>
    </main>
  );
}
