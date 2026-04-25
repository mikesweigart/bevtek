import { createClient } from "@/utils/supabase/server";
import { CheckoutButton } from "./CheckoutButton";
import { isStripeConfigured } from "@/lib/stripe/client";
import { openBillingPortalAction } from "./portalAction";
import { getNextInvoice } from "./nextInvoice";

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

export default async function BillingPage({
  searchParams,
}: {
  // Next 16 passes searchParams as a Promise; await it before reading.
  // The trial_expired flag is stamped by utils/supabase/proxy.ts when it
  // redirects a trial-expired user here.
  searchParams: Promise<{ trial_expired?: string }>;
}) {
  const sp = await searchParams;
  const trialExpired = sp.trial_expired === "1";

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
  const stripeReady = isStripeConfigured();

  // Pull the upcoming invoice so we can show "Next charge: $249 on Apr 23".
  const nextInvoice =
    hasStripe && s?.stripe_customer_id
      ? await getNextInvoice(s.stripe_customer_id)
      : null;

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

      {trialExpired && (
        <div className="rounded-md border border-red-300 bg-red-50 text-red-900 p-4 text-sm">
          <p className="font-semibold">Your free trial has ended.</p>
          <p className="mt-1">
            {isOwner
              ? "Pick a plan below to keep using Megan. Your store data, team, and inventory are all preserved — nothing's been deleted."
              : "Only the store owner can upgrade. Ask them to visit this page."}
          </p>
        </div>
      )}

      {!isOwner && !trialExpired && (
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
                <CheckoutButton
                  plan={plan.key}
                  label={
                    plan.key === "enterprise"
                      ? "Talk to sales"
                      : currentPlan === "trial"
                        ? "Start 14-day trial"
                        : plan.price > (PLANS.find((p) => p.key === currentPlan)?.price ?? 0)
                          ? "Upgrade"
                          : "Switch"
                  }
                  highlight={plan.highlight}
                  disabled={!stripeReady || plan.key === "enterprise"}
                />
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

      {isOwner && hasStripe && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                Payment & invoices
              </p>
              {nextInvoice ? (
                <>
                  <p className="text-2xl font-semibold mt-1">
                    Next charge{" "}
                    <span className="text-[color:var(--color-gold)]">
                      ${(nextInvoice.amountDue / 100).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-sm text-[color:var(--color-muted)]">
                    on{" "}
                    {new Date(
                      nextInvoice.dateSeconds * 1000,
                    ).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[color:var(--color-muted)] mt-1">
                  Stripe is connected. Manage your card, download invoices,
                  and see your next billing date in the portal.
                </p>
              )}
            </div>
            <form action={openBillingPortalAction}>
              <button
                type="submit"
                className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
              >
                Update payment / view invoices
              </button>
            </form>
          </div>
        </div>
      )}

      {isOwner && !hasStripe && (
        <div className="rounded-lg border border-[color:var(--color-border)] p-5 space-y-2">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Payment setup
          </h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Pick a plan above to start your 14-day trial. No card required
            until the trial ends. Once subscribed you&rsquo;ll get a
            self-serve portal right here to update your card and download
            invoices.
          </p>
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
