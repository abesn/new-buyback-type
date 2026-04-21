import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = headers().get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Helper: find tenant by Stripe customer ID
  const getTenantByCustomer = async (customerId: string) =>
    db.tenant.findFirst({ where: { stripeCustomerId: customerId } });

  switch (event.type) {
    case "customer.subscription.trial_will_end": {
      // 3 days before trial ends — optionally send email (skip for now, just log)
      console.log("[stripe] Trial will end:", (event.data.object as import("stripe").Stripe.Subscription).id);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      const tenant = await getTenantByCustomer(sub.customer as string);
      if (!tenant) break;
      let status: string = tenant.status;
      if (sub.status === "active")   status = "ACTIVE";
      if (sub.status === "trialing") status = "TRIAL";
      if (sub.status === "past_due") status = "PAST_DUE";
      if (sub.status === "canceled") status = "CANCELLED";
      await db.tenant.update({ where: { id: tenant.id }, data: { status: status as never } });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      const tenant = await getTenantByCustomer(sub.customer as string);
      if (tenant) {
        await db.tenant.update({ where: { id: tenant.id }, data: { status: "CANCELLED" } });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice;
      const tenant = await getTenantByCustomer(invoice.customer as string);
      if (tenant) {
        await db.tenant.update({ where: { id: tenant.id }, data: { status: "PAST_DUE" } });
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice;
      const tenant = await getTenantByCustomer(invoice.customer as string);
      if (tenant && tenant.status === "PAST_DUE") {
        await db.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

// Stripe requires raw body — disable Next.js body parsing
export const config = { api: { bodyParser: false } };
