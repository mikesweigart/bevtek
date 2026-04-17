import { getStripe } from "@/lib/stripe/client";

// Best-effort lookup of the upcoming invoice so the Billing page can show
// a real "Next charge: $199 on Apr 23" line instead of a vague message.

export type NextInvoice = {
  amountDue: number;      // in cents
  currency: string;       // "usd"
  dateSeconds: number;    // unix seconds
} | null;

export async function getNextInvoice(
  customerId: string,
): Promise<NextInvoice> {
  const stripe = await getStripe();
  if (!stripe || !customerId) return null;
  try {
    // `invoices.retrieveUpcoming` works for active subscriptions.
    // Some API versions scoped this under `invoices.upcoming`; both exist
    // in recent versions, fall through if unsupported.
    // @ts-expect-error the SDK ships both method names across versions
    const fn = stripe.invoices.retrieveUpcoming ?? stripe.invoices.upcoming;
    if (typeof fn !== "function") return null;
    const upcoming = await fn.call(stripe.invoices, { customer: customerId });
    return {
      amountDue: upcoming.amount_due,
      currency: upcoming.currency,
      dateSeconds:
        upcoming.next_payment_attempt ??
        upcoming.period_end ??
        Math.floor(Date.now() / 1000),
    };
  } catch {
    return null;
  }
}
