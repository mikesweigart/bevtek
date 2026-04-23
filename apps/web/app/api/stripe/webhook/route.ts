import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe/client";
import {
  checkAndClaim,
  markFailed,
  markHandled,
} from "@/lib/webhooks/idempotency";
import { logAudit } from "@/lib/audit/log";
import { sendBillingAlertEmail } from "@/lib/email/sendBillingAlert";

// Stripe sends webhook events here when subscriptions change.
// Configure at stripe.com/dashboard → Developers → Webhooks.
// Events we handle today (missing ones are logged but no-op):
//   - checkout.session.completed          (new subscription / first card)
//   - customer.subscription.updated       (plan change, trial ended, status)
//   - customer.subscription.deleted       (cancellation)
//   - customer.subscription.trial_will_end (3 days before trial ends)
//   - invoice.payment_succeeded           (receipt — Stripe emails; we audit)
//   - invoice.payment_failed              (owner email + audit)
//
// Idempotency: Stripe delivers at-least-once and retries aggressively on
// any non-2xx. We dedupe by event.id through the webhook_events ledger so
// plan transitions don't double-apply.
//
// Why service-role on writes: this handler has no user session — Stripe
// posts it. The `stores` UPDATE policy requires a logged-in store member,
// which we aren't. Service-role bypasses RLS; we compensate by validating
// the Stripe signature before trusting any payload field.

// --- Service client --------------------------------------------------------

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// --- Helpers ---------------------------------------------------------------

/**
 * Update a store's plan (and optionally stripe_customer_id) AND return the
 * plan value that was there before, so the caller can drop an audit row
 * that answers "who was on what plan when?". Never throws — returns
 * `{ previousPlan: null }` on any failure so the webhook handler logs the
 * new state rather than erroring out the whole event.
 */
async function updateStorePlan(
  storeId: string,
  plan: string,
  stripeCustomerId?: string | null,
): Promise<{ previousPlan: string | null }> {
  const client = svc();
  if (!client) return { previousPlan: null };
  try {
    const { data: prior } = await client
      .from("stores")
      .select("plan")
      .eq("id", storeId)
      .maybeSingle();
    const previousPlan =
      (prior as { plan?: string | null } | null)?.plan ?? null;

    const updates: Record<string, unknown> = { plan };
    if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
    await client.from("stores").update(updates).eq("id", storeId);
    return { previousPlan };
  } catch {
    return { previousPlan: null };
  }
}

type ResolvedStore = {
  storeId: string;
  storeName: string;
  ownerEmail: string | null;
};

/**
 * Find the store + owner email for a Stripe customer, so events that only
 * carry a customer_id (invoice.*, trial_will_end) can still reach the
 * right inbox. Null when we have no record of the customer (rare — happens
 * when an event fires before checkout.session.completed writes the ID).
 */
async function resolveStoreFromCustomer(
  customerId: string,
): Promise<ResolvedStore | null> {
  const client = svc();
  if (!client) return null;
  try {
    const { data: store } = await client
      .from("stores")
      .select("id, name")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (!store) return null;
    const s = store as { id: string; name: string };

    const { data: owner } = await client
      .from("users")
      .select("email")
      .eq("store_id", s.id)
      .eq("role", "owner")
      .maybeSingle();

    return {
      storeId: s.id,
      storeName: s.name,
      ownerEmail: (owner as { email?: string | null } | null)?.email ?? null,
    };
  } catch {
    return null;
  }
}

/** Normalize `Stripe.Customer | string | null | undefined` to a string id. */
function customerIdOf(
  c: string | { id: string } | null | undefined,
): string | null {
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

// --- Handler ---------------------------------------------------------------

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

  // Idempotency gate — see header comment for rationale.
  const claim = await checkAndClaim({
    provider: "stripe",
    eventId: event.id,
    eventType: event.type,
  });
  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      // --- Subscription lifecycle ---------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as import("stripe").default.Checkout.Session;
        const storeId = session.metadata?.store_id;
        const plan = session.metadata?.plan;
        const customerId = customerIdOf(session.customer);
        if (storeId && plan) {
          const { previousPlan } = await updateStorePlan(
            storeId,
            plan,
            customerId,
          );
          await logAudit({
            action: "billing.subscription.start",
            storeId,
            metadata: {
              previous_plan: previousPlan,
              new_plan: plan,
              stripe_customer_id: customerId,
              checkout_session_id: session.id,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as import("stripe").default.Subscription;
        const storeId = sub.metadata?.store_id;
        const plan = sub.metadata?.plan;
        if (storeId && plan) {
          const { previousPlan } = await updateStorePlan(storeId, plan);
          if (previousPlan !== plan) {
            await logAudit({
              action: "billing.subscription.update",
              storeId,
              metadata: {
                previous_plan: previousPlan,
                new_plan: plan,
                stripe_subscription_id: sub.id,
                status: sub.status,
              },
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as import("stripe").default.Subscription;
        const storeId = sub.metadata?.store_id;
        if (storeId) {
          const { previousPlan } = await updateStorePlan(storeId, "canceled");
          await logAudit({
            action: "billing.subscription.cancel",
            storeId,
            metadata: {
              previous_plan: previousPlan,
              stripe_subscription_id: sub.id,
              canceled_at: sub.canceled_at
                ? new Date(sub.canceled_at * 1000).toISOString()
                : new Date().toISOString(),
            },
          });
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        // Fires 3 days before trial converts. Give the owner a heads-up
        // so they can update payment or cancel before the first charge.
        const sub = event.data.object as import("stripe").default.Subscription;
        const storeId = sub.metadata?.store_id ?? null;
        const customerId = customerIdOf(sub.customer);
        const trialEnd = sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null;
        const resolved = customerId
          ? await resolveStoreFromCustomer(customerId)
          : null;
        const resolvedStoreId = storeId ?? resolved?.storeId ?? null;
        if (resolvedStoreId) {
          await logAudit({
            action: "billing.trial.ending",
            storeId: resolvedStoreId,
            metadata: {
              stripe_subscription_id: sub.id,
              trial_end: trialEnd,
            },
          });
        }
        if (resolved?.ownerEmail) {
          await sendBillingAlertEmail({
            to: resolved.ownerEmail,
            storeName: resolved.storeName,
            kind: "trial_ending",
            trialEnd,
          });
        }
        break;
      }

      // --- Invoice lifecycle --------------------------------------------
      case "invoice.payment_succeeded": {
        // Stripe already sends its own receipt email; we skip the email
        // to avoid duplication and just record the payment in the audit
        // trail so the admin /admin/health + billing history views can
        // answer "when did charges last go through for this store?".
        const invoice = event.data.object as import("stripe").default.Invoice;
        const customerId = customerIdOf(invoice.customer);
        if (customerId) {
          const resolved = await resolveStoreFromCustomer(customerId);
          if (resolved) {
            await logAudit({
              action: "billing.invoice.paid",
              storeId: resolved.storeId,
              metadata: {
                stripe_invoice_id: invoice.id,
                amount_paid_cents: invoice.amount_paid,
                currency: invoice.currency,
                invoice_number: invoice.number,
                period_start: invoice.period_start
                  ? new Date(invoice.period_start * 1000).toISOString()
                  : null,
                period_end: invoice.period_end
                  ? new Date(invoice.period_end * 1000).toISOString()
                  : null,
              },
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as import("stripe").default.Invoice;
        const customerId = customerIdOf(invoice.customer);
        console.error(
          `Stripe payment failed for customer ${customerId ?? "unknown"}: ${invoice.id}`,
        );
        if (customerId) {
          const resolved = await resolveStoreFromCustomer(customerId);
          if (resolved) {
            await logAudit({
              action: "billing.invoice.failed",
              storeId: resolved.storeId,
              metadata: {
                stripe_invoice_id: invoice.id,
                amount_due_cents: invoice.amount_due,
                currency: invoice.currency,
                attempt_count: invoice.attempt_count,
                next_payment_attempt: invoice.next_payment_attempt
                  ? new Date(invoice.next_payment_attempt * 1000).toISOString()
                  : null,
              },
            });
            if (resolved.ownerEmail) {
              // Fire-and-forget email — sendBillingAlertEmail is no-throw
              // and returns { ok: false } if Resend isn't configured. We
              // audit the attempt either way.
              await sendBillingAlertEmail({
                to: resolved.ownerEmail,
                storeName: resolved.storeName,
                kind: "payment_failed",
                amountDueCents: invoice.amount_due,
                invoiceUrl: invoice.hosted_invoice_url ?? null,
              });
            }
          }
        }
        break;
      }

      default:
        // Unhandled event type — log but don't error. Stripe sends many
        // event types by default; we enable only the ones we care about,
        // and silently ack the rest so the retry queue stays empty.
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    await markHandled("stripe", event.id);
    return NextResponse.json({ received: true });
  } catch (e) {
    const msg = (e as Error)?.message ?? "unknown";
    await markFailed("stripe", event.id, msg);
    Sentry.captureException(e, {
      tags: {
        webhook: "stripe",
        event_type: event.type,
      },
      extra: { event_id: event.id },
    });
    // Return 500 so Stripe retries — the ledger row stays unhandled, and
    // the next retry will re-enter the handler with a fresh transaction.
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}
