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
      <MobileAppSpotlight />
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

// ---------------------------------------------------------------------------
// MobileAppSpotlight — the "look at how real this is" section. Three live
// phone-frame previews: Gabby chat (customer), Hold requests (customer),
// and the employee leaderboard / training dashboard. Zero external images;
// everything is styled divs so it renders instantly.
// ---------------------------------------------------------------------------
function MobileAppSpotlight() {
  return (
    <section className="px-6 py-16 sm:py-24 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(200,152,78,0.08), transparent 60%)",
        }}
      />
      <div className="relative max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-gold)] font-semibold">
            New · Mobile apps in customer beta
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Gabby lives in every customer&rsquo;s pocket.
          </h2>
          <p className="text-[color:var(--color-muted)] leading-relaxed">
            Real-time inventory. Voice-enabled AI concierge. One-tap holds.
            Print a QR code, tape it at the counter, and your store is open
            on every phone that walks in.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 items-start">
          <PhoneFrame title="Gabby · Customer" accent>
            <GabbyChatPreview />
          </PhoneFrame>
          <PhoneFrame title="Hold requests">
            <HoldsPreview />
          </PhoneFrame>
          <PhoneFrame title="Employee · Trainer">
            <TrainerPreview />
          </PhoneFrame>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCallout
            kicker="Scan & Shop"
            title="Your own QR code"
            body="Print it. Tape it anywhere. Customers scan, Gabby greets them, they buy."
          />
          <FeatureCallout
            kicker="Voice-first"
            title="Gabby speaks out loud"
            body="Tap Listen and she reads her recommendation — hands-free while you stock."
          />
          <FeatureCallout
            kicker="Closes the loop"
            title="Customer holds, instantly"
            body="Shopper hits Hold. Owner gets an email. Item is waiting at the counter."
          />
        </div>
      </div>
    </section>
  );
}

function PhoneFrame({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative w-[280px] h-[560px] rounded-[40px] p-[10px] shadow-2xl ${
          accent
            ? "bg-gradient-to-b from-[color:var(--color-gold)] to-[#9a7237]"
            : "bg-zinc-900"
        }`}
      >
        <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[90px] h-[22px] bg-black rounded-full z-10" />
        <div className="w-full h-full rounded-[32px] bg-[#FBF7F0] overflow-hidden relative">
          {children}
        </div>
      </div>
      <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
        {title}
      </p>
    </div>
  );
}

function GabbyChatPreview() {
  return (
    <div className="flex flex-col h-full pt-12 pb-4 px-4 text-[13px]">
      <div className="text-center pb-3 border-b border-zinc-200">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--color-gold)] text-white font-bold text-sm">
          G
        </div>
        <p className="mt-1 font-semibold">Hi, I&rsquo;m Gabby</p>
        <p className="text-[10px] italic text-[color:var(--color-gold)]">
          Find it, Pair it, Love it
        </p>
      </div>
      <div className="flex-1 overflow-hidden space-y-2 mt-3">
        <div className="ml-auto max-w-[80%] bg-[color:var(--color-gold)] text-white rounded-2xl rounded-br-sm px-3 py-2 text-[12px]">
          What bourbon pairs with steak tonight?
        </div>
        <div className="max-w-[90%] bg-white rounded-2xl rounded-bl-sm px-3 py-2 text-[12px] shadow-sm border border-zinc-100">
          Great call! I&rsquo;d grab the <b>Woodford Reserve</b> at{" "}
          <span className="text-[color:var(--color-gold)] font-semibold">
            $42
          </span>{" "}
          — rich caramel notes cut a char-grilled ribeye beautifully.
          <div className="mt-2 text-[10px] bg-zinc-50 text-zinc-500 rounded px-2 py-1 inline-block">
            🔊 Listen
          </div>
        </div>
        <div className="ml-auto max-w-[80%] bg-[color:var(--color-gold)] text-white rounded-2xl rounded-br-sm px-3 py-2 text-[12px]">
          Can you hold one for me?
        </div>
      </div>
      <div className="mt-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-400 flex items-center justify-between">
        Ask anything… <span className="text-[color:var(--color-gold)]">▶</span>
      </div>
    </div>
  );
}

function HoldsPreview() {
  const items = [
    { name: "Woodford Reserve", sub: "Bourbon · $42", status: "Ready" },
    { name: "Caymus Cabernet", sub: "Red wine · $89", status: "Pending" },
    { name: "Casamigos Blanco", sub: "Tequila · $52", status: "Picked up" },
  ];
  const pill: Record<string, string> = {
    Ready: "bg-green-100 text-green-700",
    Pending: "bg-amber-100 text-amber-700",
    "Picked up": "bg-zinc-100 text-zinc-500",
  };
  return (
    <div className="flex flex-col h-full pt-12 pb-4 px-4">
      <div className="pb-3 border-b border-zinc-200">
        <p className="text-[10px] tracking-widest uppercase text-zinc-500">
          My Holds
        </p>
        <h3 className="text-lg font-semibold">3 items waiting</h3>
      </div>
      <div className="flex-1 space-y-2 mt-3">
        {items.map((it) => (
          <div
            key={it.name}
            className="bg-white rounded-xl border border-zinc-100 p-3 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-[13px] font-semibold">{it.name}</p>
              <p className="text-[11px] text-zinc-500">{it.sub}</p>
            </div>
            <span
              className={`text-[10px] font-medium rounded-full px-2 py-1 ${pill[it.status]}`}
            >
              {it.status}
            </span>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-[color:var(--color-gold)] text-white text-center py-3 text-[13px] font-semibold shadow">
        Browse the shop →
      </div>
    </div>
  );
}

function TrainerPreview() {
  return (
    <div className="flex flex-col h-full pt-12 pb-4 px-4">
      <div className="pb-3 border-b border-zinc-200">
        <p className="text-[10px] tracking-widest uppercase text-zinc-500">
          Welcome back
        </p>
        <h3 className="text-lg font-semibold">Alex</h3>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[11px] bg-[color:var(--color-gold)] text-white rounded-full px-2 py-0.5 font-semibold">
            ⭐ 142
          </span>
          <span className="text-[11px] text-zinc-500">🔥 6-day streak</span>
        </div>
      </div>
      <div className="flex-1 mt-3 space-y-2 overflow-hidden">
        <div className="rounded-xl bg-zinc-900 text-white p-3">
          <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-gold)]">
            Team leaderboard
          </p>
          <p className="text-sm font-semibold mt-1">You&rsquo;re #2 this week</p>
        </div>
        <p className="text-[10px] tracking-widest uppercase text-zinc-500 pt-1">
          Pick up where you left off
        </p>
        <div className="bg-white rounded-xl border border-zinc-100 p-3 shadow-sm">
          <p className="text-[12px] font-semibold">Bourbon 101</p>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
            <div className="h-full w-[60%] bg-[color:var(--color-gold)]" />
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">3/5 lessons</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl border border-zinc-100 p-2.5 text-center">
            <p className="text-[18px]">🍷</p>
            <p className="text-[10px] font-semibold mt-1">Wine</p>
            <p className="text-[9px] text-zinc-500">8/12</p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-100 p-2.5 text-center">
            <p className="text-[18px]">🥃</p>
            <p className="text-[10px] font-semibold mt-1">Spirits</p>
            <p className="text-[9px] text-zinc-500">5/11</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCallout({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-5 space-y-2">
      <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-gold)] font-semibold">
        {kicker}
      </p>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
        {body}
      </p>
    </div>
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
    monthly: 79,
    tagline: "Megan Trainer. Up to 10 staff.",
    features: [
      "All 44 beverage training modules",
      "Quizzes with retry + star rewards",
      "Level system (Newcomer → Elite)",
      "Voice narration (listen while stocking)",
      "Manager progress dashboard",
      "Up to 10 staff members",
    ],
    cta: "Start free trial",
    best: "Small shops",
    highlight: false,
  },
  {
    name: "Pro",
    monthly: 199,
    tagline: "Trainer + live AI floor assistant + voice.",
    features: [
      "Everything in Starter",
      "Unlimited staff",
      "Ask Megan — text floor assistant",
      "Megan Voice — listens + responds in under a second",
      "Guided customer walk flow",
      "CSV inventory upload",
    ],
    cta: "Start free trial",
    best: "Stores focused on the floor",
    highlight: false,
  },
  {
    name: "Pro Plus",
    monthly: 249,
    tagline: "Pro + iMessage customer recaps.",
    features: [
      "Everything in Pro",
      "Post-call iMessage summaries",
      "Hold request confirmations by text",
      "Two-way customer text chat",
      "No A2P registration needed",
      "Blue bubble — feels personal",
    ],
    cta: "Start free trial",
    best: "Most stores pick this",
    highlight: true,
  },
  {
    name: "Enterprise",
    monthly: 399,
    tagline: "Full suite — Shopper + live POS + multi-location.",
    features: [
      "Everything in Pro Plus",
      "Megan Shopper (customer app)",
      "“Hold this” customer requests",
      "Live POS API sync",
      "Multi-location dashboard",
      "Custom module builder (PDF → module)",
    ],
    cta: "Talk to sales",
    best: "Multi-location / high volume",
    highlight: false,
  },
];

const ADD_ONS = [
  {
    name: "Megan Receptionist",
    price: 49,
    desc: "24/7 AI answers your inbound phone line",
  },
  {
    name: "White-glove onboarding",
    price: 149,
    desc: "One-time · we set everything up for you",
  },
  {
    name: "Custom branded voice",
    price: 19,
    desc: "$99 setup · Megan in your brand voice",
  },
  {
    name: "Extra module pack",
    price: 49,
    desc: "Store-specific training content",
  },
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

        <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-4 items-start">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl bg-white p-6 space-y-5 ${
                t.highlight
                  ? "border-2 border-[color:var(--color-gold)] shadow-lg lg:-translate-y-2"
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
                <p className="text-sm text-[color:var(--color-muted)] mt-1 min-h-[2.5rem] leading-snug">
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
                  per location · billed monthly
                </p>
              </div>
              <Link
                href={
                  t.name === "Enterprise" ? "mailto:sales@bevtek.ai" : "/signup"
                }
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
    a: "Yes — our native iOS and Android apps are live in customer beta right now. Staff get the Trainer + floor-side Assistant; customers get Gabby, your mobile storefront, and one-tap holds. Public App Store / Play Store launch this summer. Existing users can get beta access on request.",
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
          <Link href="/support" className="hover:text-[color:var(--color-fg)]">
            Support
          </Link>
          <Link href="/privacy" className="hover:text-[color:var(--color-fg)]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[color:var(--color-fg)]">
            Terms
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
