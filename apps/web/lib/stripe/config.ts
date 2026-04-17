// Stripe configuration — maps BevTek plans to Stripe price IDs.
// Fill in the price IDs after creating products in your Stripe dashboard.
//
// To set up:
// 1. Go to stripe.com/dashboard → Products
// 2. Create 4 products (Starter, Pro, Pro Plus, Enterprise)
// 3. Each product gets a monthly recurring price
// 4. Copy each price ID (starts with "price_") into this file
// 5. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local

export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER ?? "",
    amount: 7900, // $79.00 in cents
    interval: "month" as const,
    features: [
      "Megan Trainer (100 modules)",
      "Quizzes, stars, leaderboard",
      "Up to 10 staff",
      "Manager dashboard",
    ],
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    amount: 19900,
    interval: "month" as const,
    features: [
      "Everything in Starter",
      "Unlimited staff",
      "Megan Assistant (AI floor search)",
      "Megan Voice",
      "CSV inventory import",
    ],
  },
  pro_plus: {
    name: "Pro Plus",
    priceId: process.env.STRIPE_PRICE_PRO_PLUS ?? "",
    amount: 24900,
    interval: "month" as const,
    features: [
      "Everything in Pro",
      "iMessage customer recaps",
      "Hold request confirmations",
      "Two-way customer texting",
    ],
  },
  enterprise: {
    name: "Enterprise",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
    amount: 39900,
    interval: "month" as const,
    features: [
      "Everything in Pro Plus",
      "Megan Shopper (customer app)",
      "Hold-this-for-me requests",
      "Live POS sync",
      "Multi-location dashboard",
      "Custom module builder",
    ],
  },
} as const;

export const STRIPE_ADD_ONS = {
  receptionist: {
    name: "Megan Receptionist",
    priceId: process.env.STRIPE_PRICE_RECEPTIONIST ?? "",
    amount: 4900,
    interval: "month" as const,
  },
  onboarding: {
    name: "White-glove onboarding",
    priceId: process.env.STRIPE_PRICE_ONBOARDING ?? "",
    amount: 14900,
    interval: null, // one-time
  },
  voice: {
    name: "Custom branded voice",
    priceId: process.env.STRIPE_PRICE_VOICE ?? "",
    amount: 1900,
    interval: "month" as const,
  },
  modules: {
    name: "Extra module pack",
    priceId: process.env.STRIPE_PRICE_MODULES ?? "",
    amount: 4900,
    interval: "month" as const,
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PLANS;
export type AddOnKey = keyof typeof STRIPE_ADD_ONS;

export const TRIAL_DAYS = 14;
