import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
});

// Stripe Price IDs (set these in environment variables)
export const PRICE_IDS: Record<"STARTER" | "GROWTH" | "PRO", Record<"monthly" | "annual", string>> = {
  STARTER: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL  ?? "",
  },
  GROWTH: {
    monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY  ?? "",
    annual:  process.env.STRIPE_PRICE_GROWTH_ANNUAL   ?? "",
  },
  PRO: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY     ?? "",
    annual:  process.env.STRIPE_PRICE_PRO_ANNUAL      ?? "",
  },
};
