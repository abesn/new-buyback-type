import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// GET /api/register?slug=<slug>
// Check whether a tenant slug is available.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";

  // Validate: lowercase alphanumeric + hyphens, 3–40 chars
  const slugRegex = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$|^[a-z0-9]{3,40}$/;
  if (!slugRegex.test(slug) || slug.length < 3 || slug.length > 40) {
    return NextResponse.json(
      { available: false, slug, error: "invalid-slug" },
      { status: 400 }
    );
  }

  const existing = await db.tenant.findUnique({ where: { slug } });
  return NextResponse.json({ available: !existing, slug });
}

// POST /api/register/prepare
// Create a Stripe Customer + SetupIntent before showing the payment form.
// Does NOT create a User or Tenant yet.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, businessName } = body as {
    email: string;
    businessName: string;
  };

  if (!email || !businessName) {
    return NextResponse.json(
      { error: "missing-fields" },
      { status: 400 }
    );
  }

  // Guard: email must not already belong to an existing user
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "email-taken" }, { status: 409 });
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: businessName,
    metadata: { businessName },
  });

  // Create SetupIntent (payment method will be confirmed on the client)
  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    usage: "off_session",
    metadata: { email, businessName },
  });

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    stripeCustomerId: customer.id,
  });
}
