/**
 * POST /api/billing/cancel
 *
 * Cancel the tenant's Stripe subscription at the end of the current period
 * (or immediately if still in trial). Updates tenant status to CANCELLED.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === UserRole.STAFF) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true, status: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Cancel in Stripe if subscription exists
  if (tenant.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);

      if (sub.status === "trialing") {
        // Still in trial — cancel immediately, no charge
        await stripe.subscriptions.cancel(tenant.stripeSubscriptionId);
      } else {
        // Active — cancel at period end so they keep access until paid period ends
        await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }
    } catch (err) {
      console.error("[billing] Stripe cancel error:", err);
      // Don't block DB update if Stripe call fails
    }
  }

  // Mark cancelled in DB
  await db.tenant.update({
    where: { id: tenantId },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ ok: true });
}
