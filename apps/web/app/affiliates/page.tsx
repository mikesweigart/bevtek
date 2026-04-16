import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program",
  description:
    "Share your 10% discount code. Earn 15% recurring commission for life on every customer who redeems it.",
  openGraph: {
    title: "BevTek Affiliate Program",
    description:
      "Share your 10% discount code. Earn 15% recurring commission for life.",
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

      <section className="px-6 pt-20 pb-14 sm:pt-28 sm:pb-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-[color:var(--color-muted)] border border-[color:var(--color-border)] rounded-full px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
            Partner Program
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Give <span className="text-[color:var(--color-gold)]">10% off</span>.
            <br />
            Keep <span className="text-[color:var(--color-gold)]">15%</span> forever.
          </h1>
          <p className="text-lg sm:text-xl text-[color:var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
            You get a personal discount code. Stores you share it with save 10%.
            You earn 15% recurring commission on every dollar they spend — for
            as long as they&apos;re a customer.
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
              { headline: "10%", title: "Discount code to share", body: "Your custom code (like MIKE10) gives stores 10% off every month they stay subscribed." },
              { headline: "15%", title: "Recurring commission", body: "Every dollar your referred stores pay, 15% flows to you — every month, for as long as they're a customer." },
              { headline: "Life", title: "As long as they stay", body: "No caps. No expirations. Sign up a store in 2026, still earning on them in 2030." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-[color:var(--color-border)] bg-white p-6 space-y-2">
                <p className="text-4xl font-semibold text-[color:var(--color-gold)]">{item.headline}</p>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
              Assumes $100/mo avg. plan · 15% commission · after the 10% customer discount. Illustrative only.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { refs: "5 stores", monthly: "$75/mo", year: "$900/yr" },
              { refs: "25 stores", monthly: "$375/mo", year: "$4,500/yr" },
              { refs: "100 stores", monthly: "$1,500/mo", year: "$18,000/yr" },
            ].map((row) => (
              <div key={row.refs} className="rounded-xl border border-[color:var(--color-border)] p-6 text-center">
                <p className="text-sm text-[color:var(--color-muted)]">{row.refs}</p>
                <p className="text-2xl font-semibold mt-1">{row.monthly}</p>
                <p className="text-xs text-[color:var(--color-muted)] mt-1">{row.year}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
              "Get your custom 10% discount code (and a referral link, too).",
              "Share the code with stores, distributors, newsletters, podcasts — wherever makes sense.",
              "When they redeem it, your 15% commission starts. Paid monthly via Stripe.",
            ].map((step, i) => (
              <li key={step} className="rounded-lg border border-[color:var(--color-border)] bg-white p-5 flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-[color:var(--color-gold)] text-white flex items-center justify-center text-sm font-semibold">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Who this is for
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              If you know beverage retail, you already qualify.
            </h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 text-sm">
            {[
              "Distributors and reps who visit dozens of stores each week.",
              "POS consultants and retail software installers.",
              "Industry newsletters, podcasts, and YouTube channels.",
              "Store owners with friends in the business.",
              "Franchise organizations and buying groups.",
              "Anyone with a rolodex in beverage retail.",
            ].map((x) => (
              <li key={x} className="flex gap-2 rounded-lg border border-[color:var(--color-border)] p-4">
                <span className="text-[color:var(--color-gold)] font-semibold">•</span>
                <span className="text-[color:var(--color-muted)] leading-relaxed">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24 bg-zinc-50 border-y border-[color:var(--color-border)]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight">
            Ready to get your code?
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

      {/* B2B partner tiers */}
      <section className="px-6 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Strategic partnerships
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Bring stores at scale.
            </h2>
            <p className="text-[color:var(--color-muted)] leading-relaxed">
              POS companies, payment processors, and distributors already serve
              every store we want. Let&apos;s make BevTek a value-add for your
              customers — and a revenue stream for you.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3 items-start">
            <div className="rounded-2xl border-2 border-[color:var(--color-gold)] bg-white p-6 space-y-3 md:-translate-y-2 shadow-lg">
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                Tier 1
              </p>
              <h3 className="text-xl font-semibold">POS companies</h3>
              <p className="text-3xl font-semibold text-[color:var(--color-gold)]">
                20%
              </p>
              <p className="text-xs text-[color:var(--color-muted)]">
                Recurring · 90-day attribution
              </p>
              <p className="text-sm text-[color:var(--color-muted)] leading-relaxed pt-2">
                Lightspeed, KORONA, mPower, Bottle POS — your existing customers
                are our target market. Recommending BevTek makes your product
                stickier.
              </p>
              <p className="text-xs text-[color:var(--color-fg)] font-medium pt-2">
                Example: 10 Pro Plus stores = $373.50/mo to you
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 space-y-3">
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                Tier 2
              </p>
              <h3 className="text-xl font-semibold">Payment processors</h3>
              <p className="text-3xl font-semibold text-[color:var(--color-gold)]">
                15%
              </p>
              <p className="text-xs text-[color:var(--color-muted)]">
                Recurring · 60-day attribution
              </p>
              <p className="text-sm text-[color:var(--color-muted)] leading-relaxed pt-2">
                Merchant services reps and ISOs call on liquor stores
                constantly. A BevTek referral is a value-add that helps you
                close and retain merchants.
              </p>
              <p className="text-xs text-[color:var(--color-fg)] font-medium pt-2">
                Example: 10 Pro Plus stores = $280/mo to you
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 space-y-3">
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                Tier 3
              </p>
              <h3 className="text-xl font-semibold">Store referrals</h3>
              <p className="text-3xl font-semibold text-[color:var(--color-gold)]">
                $150
              </p>
              <p className="text-xs text-[color:var(--color-muted)]">
                One-time · 30-day cookie · referred store gets 30-day free trial
              </p>
              <p className="text-sm text-[color:var(--color-muted)] leading-relaxed pt-2">
                Happy store owners tell the store down the road. Reward them
                with a flat commission when their referral converts to a paid
                plan.
              </p>
              <p className="text-xs text-[color:var(--color-fg)] font-medium pt-2">
                Already a BevTek store? You qualify automatically.
              </p>
            </div>
          </div>
          <div className="text-center pt-2">
            <a
              href="mailto:partners@bevtek.ai?subject=Partner%20Inquiry&body=Company%3A%20%0AYour%20role%3A%20%0ANumber%20of%20liquor%20store%20customers%20you%20serve%3A%20%0AAbout%20your%20business%3A%20"
              className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold border border-[color:var(--color-gold)] text-[color:var(--color-gold)] hover:bg-[color:var(--color-gold)] hover:text-white transition-colors"
            >
              Email partners@bevtek.ai
            </a>
            <p className="text-xs text-[color:var(--color-muted)] mt-3">
              We reply to partner inquiries within one business day.
            </p>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[color:var(--color-muted)]">
          <Link href="/" className="hover:text-[color:var(--color-fg)]">← Back to BevTek</Link>
          <p>© {new Date().getFullYear()} BevTek.ai</p>
        </div>
      </footer>
    </main>
  );
}
