import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe, PRICE_IDS } from "@/lib/stripe";

interface CompleteRegistrationBody {
  name: string;
  email: string;
  businessName: string;
  slug: string;
  plan: "STARTER" | "GROWTH" | "PRO";
  billing: "monthly" | "annual";
  stripeCustomerId: string;
  setupIntentId: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CompleteRegistrationBody;
  const {
    name,
    email,
    businessName,
    slug,
    plan,
    billing,
    stripeCustomerId,
    setupIntentId,
  } = body;

  // 1. Re-check email uniqueness (guard against race condition)
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "email-taken" }, { status: 409 });
  }

  // 2. Re-check slug uniqueness
  const existingTenant = await db.tenant.findUnique({ where: { slug } });
  if (existingTenant) {
    return NextResponse.json({ error: "slug-taken" }, { status: 409 });
  }

  // 3. Retrieve the SetupIntent from Stripe and verify it succeeded
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  if (setupIntent.status !== "succeeded") {
    return NextResponse.json(
      { error: "payment-not-confirmed" },
      { status: 400 }
    );
  }

  // 4. Determine price ID
  const priceId = PRICE_IDS[plan][billing];

  // 5. Create Stripe subscription (skip in dev mode when priceId is empty)
  let subscriptionId: string | null = null;
  if (priceId) {
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      default_payment_method: setupIntent.payment_method as string,
      trial_period_days: 14,
      metadata: { slug, plan, billing },
    });
    subscriptionId = subscription.id;
  }

  // 6. Compute trial end date (14 days from now)
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // 7. Create Tenant in DB
  const tenant = await db.tenant.create({
    data: {
      name: businessName,
      slug,
      plan,
      status: "TRIAL",
      stripeCustomerId,
      stripeSubscriptionId: subscriptionId ?? null,
      trialEndsAt,
    },
  });

  // 8. Create User in DB
  await db.user.create({
    data: {
      name,
      email,
      role: "TENANT_ADMIN",
      tenantId: tenant.id,
    },
  });

  // 9. Return success
  return NextResponse.json({ ok: true, tenantSlug: tenant.slug });
}
