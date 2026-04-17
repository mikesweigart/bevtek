import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/client";

// Stripe sends webhook events here when subscriptions change.
// Configure at stripe.com/dashboard → Developers → Webhooks
// Events to listen for:
//   - checkout.session.completed (new subscription)
//   - customer.subscription.updated (plan change, trial end)
//   - customer.subscription.deleted (cancellation)
//   - invoice.payment_succeeded
//   - invoice.payment_failed

export async function POST(request: NextRequest) {
  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 },
    );
  }

  let event: import("stripe").default.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as import("stripe").default.Checkout.Session;
      const storeId = session.metadata?.store_id;
      const plan = session.metadata?.plan;
      if (storeId && plan) {
        // Update the store's plan in Supabase
        const { createClient } = await import("@/utils/supabase/server");
        const supabase = await createClient();
        await supabase
          .from("stores")
          .update({ plan, stripe_customer_id: session.customer as string })
          .eq("id", storeId);
        console.log(`Store ${storeId} subscribed to ${plan}`);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as import("stripe").default.Subscription;
      const storeId = sub.metadata?.store_id;
      const plan = sub.metadata?.plan;
      if (storeId && plan) {
        const { createClient } = await import("@/utils/supabase/server");
        const supabase = await createClient();
        await supabase.from("stores").update({ plan }).eq("id", storeId);
        console.log(`Store ${storeId} updated to ${plan}`);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as import("stripe").default.Subscription;
      const storeId = sub.metadata?.store_id;
      if (storeId) {
        const { createClient } = await import("@/utils/supabase/server");
        const supabase = await createClient();
        await supabase
          .from("stores")
          .update({ plan: "canceled" })
          .eq("id", storeId);
        console.log(`Store ${storeId} canceled`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as import("stripe").default.Invoice;
      console.error(
        `Payment failed for customer ${invoice.customer}:`,
        invoice.id,
      );
      // TODO: send a "payment failed" email via Resend
      break;
    }

    default:
      // Unhandled event type — log but don't error
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
