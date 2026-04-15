import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PhoneMockup } from "@/components/PhoneMockup";
import { ShopperMock } from "@/components/mockups/ShopperMock";
import { AssistantMock } from "@/components/mockups/AssistantMock";
import { TrainerMock } from "@/components/mockups/TrainerMock";
import { ReceptionistMock } from "@/components/mockups/ReceptionistMock";
import { DashboardMock } from "@/components/mockups/DashboardMock";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  return (
    <main className="flex-1">
      <TopBar />
      <Hero />
      <Problem />
      <MeetMegan />
      <Showcase />
      <ValueStack />
      <HowItWorks />
      <Pricing />
      <Guarantee />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

function TopBar() {
  return (
    <header className="border-b border-[color:var(--color-border)]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          BevTek<span className="text-[color:var(--color-gold)]">.ai</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/affiliates"
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            Affiliates
          </Link>
          <Link
            href="/login"
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium"
          >
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-[color:var(--color-muted)] border border-[color:var(--color-border)] rounded-full px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
          Built for beverage retail
        </div>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Meet <span className="text-[color:var(--color-gold)]">Megan</span>.
          <br />
          Your best hire ever.
        </h1>
        <p className="text-lg sm:text-xl text-[color:var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
          She answers every call. Trains every new employee. Remembers every
          customer. Runs your online storefront. All for less than one
          part-time salary.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] transition-colors"
          >
            Start free — 10 minute setup
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] transition-colors"
          >
            See how it works
          </Link>
        </div>
        <p className="text-xs text-[color:var(--color-muted)] pt-1">
          No credit card · Cancel anytime · Import your inventory from any
          spreadsheet
        </p>
      </div>
    </section>
  );
}

function Problem() {
  const pains = [
    "The phone rings when you're already with a customer. Every missed call is a lost sale.",
    "You train a new hire for six weeks. Two months later they quit. You start over.",
    "Customers love you while they're in the store — then forget you exist the moment they leave.",
    "Your best nights are understaffed. Your slow nights are overstaffed. Either way, you lose.",
    "Inventory spreadsheets live in three places. Nothing is ever current.",
  ];
  return (
    <section className="px-6 py-16 sm:py-20 bg-zinc-50 border-y border-[color:var(--color-border)]">
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center">
          If you run a beverage store, you already know:
        </h2>
        <ul className="space-y-3 text-base text-[color:var(--color-fg)]">
          {pains.map((p) => (
            <li key={p} className="flex gap-3">
              <span className="text-[color:var(--color-gold)] font-semibold mt-0.5">
                ✗
              </span>
              <span className="leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>
        <p className="text-center text-[color:var(--color-muted)] pt-4">
          You don&apos;t need another app. You need another you.
        </p>
      </div>
    </section>
  );
}

function MeetMegan() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
          Introducing
        </p>
        <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
          <span className="text-[color:var(--color-gold)]">Megan</span> is the
          whole team, in one hire.
        </h2>
        <p className="text-lg text-[color:var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
          Five AI products, one monthly price, zero onboarding headaches.
          Megan plugs into the business you already run — your phone line,
          your POS inventory, your customer list — and quietly carries the
          weight.
        </p>
      </div>
    </section>
  );
}

function Showcase() {
  const screens = [
    { label: "Megan Shopper", component: <ShopperMock /> },
    { label: "Megan Assistant", component: <AssistantMock /> },
    { label: "Megan Trainer", component: <TrainerMock /> },
    { label: "Megan Receptionist", component: <ReceptionistMock /> },
    { label: "Manager Dashboard", component: <DashboardMock /> },
  ];
  return (
    <section className="px-6 py-16 sm:py-24 bg-zinc-50 border-y border-[color:var(--color-border)] overflow-hidden">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            See it on your phone
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            What Megan looks like.
          </h2>
          <p className="text-[color:var(--color-muted)] leading-relaxed">
            Mobile-first from day one. Your staff and customers never download
            an app — just open the link on any phone.
          </p>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="flex gap-8 justify-start lg:justify-center pb-4 min-w-min">
            {screens.map((s) => (
              <div key={s.label} className="shrink-0">
                <PhoneMockup label={s.label}>{s.component}</PhoneMockup>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const STACK = [
  {
    name: "Megan Receptionist",
    benefit: "Never miss another call",
    desc: "AI voice agent answers inbound calls, books orders, answers FAQs. 24/7. In any language.",
    worth: "Like a part-time receptionist for $0.",
  },
  {
    name: "Megan Assistant",
    benefit: "A product expert on every shift",
    desc: "Staff type any question — 'do we have peaty Scotch under $60?' — and Megan searches live inventory.",
    worth: "No more new-hire fumbling, no more missed upsells.",
  },
  {
    name: "Megan Trainer",
    benefit: "Onboard new staff in hours, not weeks",
    desc: "Bite-sized training modules with per-employee progress tracking. Write once, train forever.",
    worth: "Cuts onboarding time 80%.",
  },
  {
    name: "Megan Shopper",
    benefit: "Your store, on every customer's phone",
    desc: "Public mobile-first storefront with search, categories, and product pages. No app download.",
    worth: "Sell while you sleep.",
  },
  {
    name: "Megan Texting",
    benefit: "iMessage is the new receipt",
    desc: "Two-way texting with regulars. Recommendations, back-in-stock alerts, order confirmations.",
    worth: "98% open rates. Every time.",
  },
];

function ValueStack() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            Here&apos;s everything you get
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Five products. One Megan.
          </h2>
        </div>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {STACK.map((item) => (
            <div
              key={item.name}
              className="rounded-xl border border-[color:var(--color-border)] bg-white p-6 space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
                <h3 className="text-xs font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
                  {item.name}
                </h3>
              </div>
              <p className="text-xl font-semibold leading-tight">{item.benefit}</p>
              <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
                {item.desc}
              </p>
              <p className="text-xs text-[color:var(--color-gold)] font-medium italic">
                {item.worth}
              </p>
            </div>
          ))}
          <div className="rounded-xl border-2 border-[color:var(--color-gold)] bg-white p-6 space-y-3 md:col-span-2 text-center">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Total value
            </p>
            <p className="text-2xl sm:text-3xl font-semibold">
              More than a $3,500/month full-time hire — without the W-2, the
              training cost, or the sick days.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: 1, title: "Sign up free", body: "30 seconds. Email and password. No credit card." },
    { n: 2, title: "Import your inventory", body: "Drop any spreadsheet from Square, Lightspeed, or Excel. Megan figures out the columns." },
    { n: 3, title: "Turn on the features you want", body: "Flip a switch for Receptionist, Texting, Trainer, or Shopper. Add more anytime." },
    { n: 4, title: "Share your storefront", body: "Get a public link to give customers. Or keep it internal — your call." },
  ];
  return (
    <section id="how-it-works" className="px-6 py-16 sm:py-24 bg-zinc-50 border-y border-[color:var(--color-border)]">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            From zero to running
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Up and selling in 10 minutes.
          </h2>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.n} className="rounded-lg border border-[color:var(--color-border)] p-5 flex gap-4 bg-white">
              <span className="shrink-0 w-8 h-8 rounded-full bg-[color:var(--color-gold)] text-white flex items-center justify-center text-sm font-semibold">
                {s.n}
              </span>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <div className="space-y-3">
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            Simple pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            One plan. Everything included.
          </h2>
        </div>
        <div className="rounded-2xl border-2 border-[color:var(--color-gold)] bg-white p-8 sm:p-10 space-y-6 max-w-xl mx-auto">
          <div>
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Founders pricing
            </p>
            <p className="text-5xl font-semibold mt-2">
              Free<span className="text-2xl text-[color:var(--color-muted)] font-normal"> to start</span>
            </p>
            <p className="text-xs text-[color:var(--color-muted)] mt-1">
              Paid plans coming soon · your rate is locked in when they launch
            </p>
          </div>
          <ul className="space-y-2 text-sm text-left">
            {[
              "All 5 Megan products",
              "Unlimited inventory + team members",
              "Unlimited customer storefront visitors",
              "Connect Retell AI for voice",
              "Connect Sendblue for iMessage",
              "Email support",
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <span className="text-[color:var(--color-gold)] font-semibold">✓</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="block w-full rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white py-3 text-sm font-semibold text-center"
          >
            Claim your free account
          </Link>
        </div>
      </div>
    </section>
  );
}

function Guarantee() {
  return (
    <section className="px-6 py-16 sm:py-20 bg-zinc-50 border-y border-[color:var(--color-border)]">
      <div className="max-w-3xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-[color:var(--color-muted)] border border-[color:var(--color-border)] rounded-full px-3 py-1 bg-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
          Risk-free
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          If Megan doesn&apos;t pay for herself, you don&apos;t pay for Megan.
        </h2>
        <p className="text-[color:var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
          Start free. No credit card. Turn on the features that matter to your
          store. Cancel any time with one click. We don&apos;t do contracts.
        </p>
      </div>
    </section>
  );
}

const FAQS = [
  { q: "How long does setup take?", a: "About 10 minutes from signup to importing your inventory. Connecting Receptionist (Retell AI) and Texting (Sendblue) takes another 15 minutes each, but they're optional." },
  { q: "Do I need a Retell or Sendblue account?", a: "Only if you want voice calls or iMessage. The other three products (Trainer, Assistant, Shopper) work with zero external services. Pick the features you need." },
  { q: "What POS systems do you integrate with?", a: "You can upload inventory from any CSV or Excel export. We've tested Square, Lightspeed, and plain spreadsheets. Column detection is automatic." },
  { q: "Can my whole team use this?", a: "Yes. Invite staff with a single link; they get the floor-side Assistant and Trainer. Managers and owners see more." },
  { q: "Is there an iOS app?", a: "Not yet — and you don't need one. Megan is mobile-first on the web, so your staff and customers just open a link on any phone. A native iOS/Android app is on the roadmap." },
  { q: "What does it cost after launch?", a: "We'll publish plans when we move to paid. Founding accounts lock in their rate at signup and never see a price increase while active." },
];

function FAQ() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            Questions
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">Quick answers</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-lg border border-[color:var(--color-border)] bg-white">
              <summary className="cursor-pointer p-4 text-sm font-medium flex items-center justify-between">
                {f.q}
                <span className="text-[color:var(--color-muted)] group-open:rotate-45 transition-transform text-lg">+</span>
              </summary>
              <div className="px-4 pb-4 text-sm text-[color:var(--color-muted)] leading-relaxed">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="px-6 py-16 sm:py-24 bg-zinc-50 border-y border-[color:var(--color-border)]">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Stop hiring. Start Megan.
        </h2>
        <p className="text-[color:var(--color-muted)] leading-relaxed">
          Your store has a ceiling. Your best nights are the ones you wish you
          could clone yourself. Tonight, you can.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-md px-8 py-4 text-base font-semibold text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] transition-colors"
        >
          Start free — 10 minute setup
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 py-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[color:var(--color-muted)]">
        <p>© {new Date().getFullYear()} BevTek.ai — Made for beverage retail.</p>
        <div className="flex items-center gap-5">
          <Link href="/affiliates" className="hover:text-[color:var(--color-fg)]">
            Affiliate program
          </Link>
          <Link href="/login" className="hover:text-[color:var(--color-fg)]">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-[color:var(--color-fg)]">
            Start free
          </Link>
        </div>
      </div>
    </footer>
  );
}
