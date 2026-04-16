import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 79,
    desc: "Megan Trainer. Up to 10 staff.",
    features: [
      "All 44 beverage training modules",
      "Quizzes + stars + levels",
      "Voice narration",
      "Manager progress dashboard",
      "Up to 10 staff",
    ],
    highlight: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: 199,
    desc: "Trainer + live AI floor assistant.",
    features: [
      "Everything in Starter",
      "Unlimited staff",
      "Ask Megan — text + voice",
      "Guided customer walk",
      "CSV inventory upload",
    ],
    highlight: false,
  },
  {
    key: "pro_plus",
    name: "Pro Plus",
    price: 249,
    desc: "Pro + iMessage customer recaps.",
    features: [
      "Everything in Pro",
      "iMessage summaries after calls",
      "Hold confirmations by text",
      "Two-way customer chat",
      "Blue bubble delivery",
    ],
    highlight: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 399,
    desc: "Full suite — Shopper + POS + multi-location.",
    features: [
      "Everything in Pro Plus",
      "Megan Shopper (customer app)",
      "Hold-this-for-me requests",
      "Live POS API sync",
      "Multi-location dashboard",
      "Custom module builder",
    ],
    highlight: false,
  },
];

const ADD_ONS = [
  { key: "receptionist", name: "Megan Receptionist", price: 49, unit: "/mo" },
  { key: "onboarding", name: "White-glove onboarding", price: 149, unit: " one-time" },
  { key: "voice", name: "Custom branded voice", price: 19, unit: "/mo" },
  { key: "modules", name: "Extra module pack", price: 49, unit: "/mo" },
];

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role, store_id")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const p = profile as { role?: string; store_id?: string } | null;
  const isOwner = p?.role === "owner";

  const { data: store } = await supabase
    .from("stores")
    .select("plan, stripe_customer_id")
    .eq("id", p!.store_id!)
    .maybeSingle();
  const s = store as {
    plan?: string;
    stripe_customer_id?: string;
  } | null;
  const currentPlan = s?.plan ?? "trial";
  const hasStripe = Boolean(s?.stripe_customer_id);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Billing & Plans
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          {currentPlan === "trial"
            ? "You're on the free trial. Pick a plan to keep using Megan after 14 days."
            : `Current plan: ${currentPlan}. Manage or upgrade below.`}
        </p>
      </div>

      {!isOwner && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
          Only the store owner can manage billing. Ask them to visit this page.
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-4 items-start">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl bg-white p-5 space-y-4 ${
                plan.highlight
                  ? "border-2 border-[color:var(--color-gold)] shadow-lg lg:-translate-y-2"
                  : isCurrent
                    ? "border-2 border-green-500"
                    : "border border-[color:var(--color-border)]"
              }`}
            >
              {plan.highlight && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] tracking-widest uppercase bg-[color:var(--color-gold)] text-white px-3 py-1 rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] tracking-widest uppercase bg-green-600 text-white px-3 py-1 rounded-full whitespace-nowrap">
                  Current plan
                </span>
              )}
              <div>
                <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                  {plan.name}
                </p>
                <p className="text-sm text-[color:var(--color-muted)] mt-1 leading-snug">
                  {plan.desc}
                </p>
              </div>
              <div>
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-[color:var(--color-muted)]">
                    /mo
                  </span>
                </p>
                <p className="text-xs text-[color:var(--color-muted)]">
                  per location · billed monthly
                </p>
              </div>
              {isOwner && !isCurrent && (
                <button
                  disabled
                  className={`block w-full rounded-md py-2.5 text-sm font-semibold text-center transition-colors ${
                    plan.highlight
                      ? "bg-[color:var(--color-gold)] text-white opacity-60"
                      : "border border-[color:var(--color-border)] opacity-60"
                  }`}
                >
                  {currentPlan === "trial"
                    ? "Subscribe"
                    : plan.price > (PLANS.find((p) => p.key === currentPlan)?.price ?? 0)
                      ? "Upgrade"
                      : "Switch"}
                </button>
              )}
              <ul className="space-y-1.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-[color:var(--color-gold)] font-semibold">
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {isOwner && (
        <div className="rounded-lg border border-[color:var(--color-border)] p-5 space-y-3">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Stripe integration
          </h2>
          {hasStripe ? (
            <p className="text-sm text-[color:var(--color-muted)]">
              ✓ Stripe is connected. Plan changes and billing are managed
              through Stripe. To update your payment method or view invoices,
              check your email for Stripe billing links.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[color:var(--color-muted)]">
                Stripe billing is being set up. Once connected, you&apos;ll be
                able to subscribe, upgrade, and manage payment directly from
                this page.
              </p>
              <p className="text-xs text-[color:var(--color-muted)]">
                Contact{" "}
                <a
                  href="mailto:activate@bevtek.ai"
                  className="text-[color:var(--color-gold)] underline"
                >
                  activate@bevtek.ai
                </a>{" "}
                if you need help getting started.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add-ons */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)]">
          Add-ons
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ADD_ONS.map((a) => (
            <div
              key={a.key}
              className="rounded-lg border border-[color:var(--color-border)] p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">{a.name}</p>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap text-[color:var(--color-gold)]">
                +${a.price}{a.unit}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-[color:var(--color-muted)] text-center">
        All plans include a 14-day free trial · No credit card required to start
        · Cancel anytime
      </p>
    </div>
  );
}
