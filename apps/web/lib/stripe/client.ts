// Server-side Stripe client. Only used in server actions / API routes.
// Returns null if STRIPE_SECRET_KEY is not configured.

let cached: import("stripe").default | null = null;

export async function getStripe(): Promise<import("stripe").default | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (cached) return cached;

  const Stripe = (await import("stripe")).default;
  cached = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
