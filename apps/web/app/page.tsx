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
            Mobile-first from day one. Use it on the web today — native iOS
            and Android apps launching this summer.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-[10px] tracking-widest uppercase bg-white border border-[color:var(--color-border)] px-2.5 py-1 rounded-full">
              Web · Live now
            </span>
            <span className="text-[10px] tracking-widest uppercase bg-[color:var(--color-gold)] text-white px-2.5 py-1 rounded-full">
              iOS + Android · Coming summer 2026
            </span>
          </div>
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

const TIERS = [
  {
    name: "Starter",
    setup: 699,
    monthly: 399,
    tagline: "Answer every call, recover lost sales.",
    features: [
      "AI phone answering (Receptionist)",
      "Message routing via text/email",
      "Basic inventory lookup (weekly updates)",
      "Megan Trainer for staff",
      "Up to 3 team members",
      "Email support",
    ],
    cta: "Start free trial",
    best: "Small shops",
    highlight: false,
  },
  {
    name: "Pro",
    setup: 999,
    monthly: 599,
    tagline: "The full team experience — most stores pick this.",
    features: [
      "Everything in Starter",
      "Full live inventory integration",
      "Hold-for-Pickup text alerts",
      "In-store tablet/kiosk mode",
      "Megan Shopper storefront",
      "Megan Assistant (floor AI)",
      "Weekly performance reports",
      "Unlimited team members",
    ],
    cta: "Start free trial",
    best: "Stores $1–2.5M revenue",
    highlight: true,
  },
  {
    name: "Elite",
    setup: 1499,
    monthly: 899,
    tagline: "Multi-store. Custom brand voice. White-glove.",
    features: [
      "Everything in Pro",
      "Multi-store inventory sync",
      "Custom branded AI voice & tone",
      "Advanced analytics dashboard",
      "Dedicated success manager",
      "Priority 24/7 support",
      "Quarterly strategy review",
    ],
    cta: "Talk to sales",
    best: "Multi-location / high volume",
    highlight: false,
  },
];

const ADD_ONS = [
  { name: "Bilingual voice (English/Spanish)", price: 49, desc: "For diverse communities" },
  { name: "SMS follow-ups", price: 99, desc: "Quotes, orders, holds — boost repeat visits" },
  { name: "Custom training library", price: 79, desc: "Add your own brand/product modules" },
  { name: "Call transcription archive", price: 49, desc: "For compliance + insights" },
];

function Pricing() {
  return (
    <section id="pricing" className="px-6 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Pick your plan. Start free for 14 days.
          </h2>
          <p className="text-[color:var(--color-muted)] leading-relaxed">
            Even if Megan captures just 2 extra orders a day, that&apos;s{" "}
            <span className="font-semibold text-[color:var(--color-fg)]">
              $2,500/month
            </span>{" "}
            in new sales — at any plan below, you&apos;re net ahead.
          </p>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-3 items-start">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl bg-white p-6 sm:p-7 space-y-5 ${
                t.highlight
                  ? "border-2 border-[color:var(--color-gold)] shadow-lg md:-translate-y-2"
                  : "border border-[color:var(--color-border)]"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] tracking-widest uppercase bg-[color:var(--color-gold)] text-white px-3 py-1 rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}
              <div>
                <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                  {t.name}
                </p>
                <p className="text-sm text-[color:var(--color-muted)] mt-1 min-h-[2.5rem]">
                  {t.tagline}
                </p>
              </div>
              <div>
                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold">
                    ${t.monthly.toLocaleString()}
                  </span>
                  <span className="text-sm text-[color:var(--color-muted)]">
                    /mo
                  </span>
                </p>
                <p className="text-xs text-[color:var(--color-muted)] mt-1">
                  ${t.setup.toLocaleString()} one-time setup
                </p>
              </div>
              <Link
                href={t.name === "Elite" ? "mailto:sales@bevtek.ai" : "/signup"}
                className={`block w-full rounded-md py-2.5 text-sm font-semibold text-center transition-colors ${
                  t.highlight
                    ? "bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white"
                    : "border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]"
                }`}
              >
                {t.cta}
              </Link>
              <ul className="space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[color:var(--color-gold)] font-semibold">
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)] pt-2 border-t border-[color:var(--color-border)]">
                Best for: {t.best}
              </p>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-[color:var(--color-muted)]">
          All plans include a 14-day free trial · No credit card required to
          start · We handle voice + texting setup for you
        </p>

        {/* Add-ons */}
        <div className="max-w-4xl mx-auto pt-8 space-y-5">
          <div className="text-center space-y-1">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Optional add-ons
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Supercharge your Megan.
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ADD_ONS.map((a) => (
              <div
                key={a.name}
                className="rounded-lg border border-[color:var(--color-border)] p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-[color:var(--color-muted)] mt-0.5">
                    {a.desc}
                  </p>
                </div>
                <p className="text-sm font-semibold whitespace-nowrap text-[color:var(--color-gold)]">
                  +${a.price}/mo
                </p>
              </div>
            ))}
          </div>
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
  {
    q: "How long does setup take?",
    a: "About 10 minutes from signup to importing your inventory. We handle the technical setup for voice and texting — you just tell us your store phone number and we activate Megan within 24 hours.",
  },
  {
    q: "What do I need to enable texting or phone calls?",
    a: "Nothing on your end beyond telling us your store number and business hours. Voice (Receptionist) and texting are part of your Pro and Elite plans. We provision the AI agent, the iMessage number, and the integrations — you don't touch any third-party services.",
  },
  {
    q: "Is there an iOS or Android app?",
    a: "Yes — native iOS and Android apps are in development and launching this summer. Until then, Megan works beautifully on the mobile web (no install needed). Everyone on your team just opens a link on their phone; customers use your storefront the same way.",
  },
  {
    q: "What POS systems do you integrate with?",
    a: "You can upload inventory from any CSV or Excel export. We've tested Square, Lightspeed, and plain spreadsheets. Column detection is automatic. Deep POS integrations (Square, Lightspeed, Clover, BevIntel) are on the Pro and Elite plans.",
  },
  {
    q: "Can my whole team use this?",
    a: "Yes. Invite staff with a single link; they get the floor-side Assistant and Trainer. Managers and owners see more. Starter includes up to 3 team members; Pro and Elite are unlimited.",
  },
  {
    q: "What's the free trial?",
    a: "14 days. All Pro features enabled. No credit card to start. Cancel any time with one click.",
  },
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
