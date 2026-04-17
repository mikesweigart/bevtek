"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getStripe } from "@/lib/stripe/client";

// Opens the Stripe-hosted Customer Portal so the owner can update their
// payment method, view invoices, and see their next billing date. We
// create a single-use portal session on each click.

export async function openBillingPortalAction() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (p?.role !== "owner" || !p.store_id) return;

  const { data: store } = await supabase
    .from("stores")
    .select("stripe_customer_id")
    .eq("id", p.store_id)
    .maybeSingle();
  const customerId = (store as { stripe_customer_id?: string } | null)
    ?.stripe_customer_id;
  if (!customerId) return;

  const stripe = await getStripe();
  if (!stripe) return;

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/billing`,
  });

  redirect(session.url);
}
