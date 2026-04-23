import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { STRIPE_PLANS, TRIAL_DAYS, type PlanKey } from "@/lib/stripe/config";
import { checkRate, identifyRequest, rateLimitResponse } from "@/lib/rate-limit";

// POST /api/stripe/checkout — creates a Stripe Checkout session for a plan
export async function POST(request: NextRequest) {
  // Auth first so we can identify the rate-limit bucket by user. Without
  // this, an attacker would be bucketed by IP and could enumerate across
  // many users behind the same NAT.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate-limit BEFORE we hit Stripe's API. Prevents card-enumeration abuse
  // where a bot creates many Checkout sessions to probe card validity.
  const rl = await checkRate("stripe-checkout", identifyRequest(request, auth.user.id));
  if (!rl.success) return rateLimitResponse(rl);

  const body = (await request.json()) as { plan: string };
  const planKey = body.plan as PlanKey;
  const plan = STRIPE_PLANS[planKey];

  if (!plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!plan.priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured for this plan" },
      { status: 500 },
    );
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured — add STRIPE_SECRET_KEY" },
      { status: 500 },
    );
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("users")
    .select("store_id, email")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; email?: string } | null;
  if (!p?.store_id) {
    return NextResponse.json({ error: "No store" }, { status: 400 });
  }

  const { data: store } = await supabase
    .from("stores")
    .select("stripe_customer_id, name")
    .eq("id", p.store_id)
    .maybeSingle();
  const s = store as {
    stripe_customer_id?: string;
    name?: string;
  } | null;

  let customerId = s?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: p.email ?? auth.user.email ?? undefined,
      name: s?.name ?? undefined,
      metadata: {
        store_id: p.store_id,
        user_id: auth.user.id,
      },
    });
    customerId = customer.id;
    await supabase
      .from("stores")
      .update({ stripe_customer_id: customerId })
      .eq("id", p.store_id);
  }

  const { origin } = new URL(request.url);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: {
        store_id: p.store_id,
        plan: planKey,
      },
    },
    success_url: `${origin}/billing?success=1&plan=${planKey}`,
    cancel_url: `${origin}/billing?canceled=1`,
    metadata: {
      store_id: p.store_id,
      plan: planKey,
    },
  });

  return NextResponse.json({ url: session.url });
}
