/**
 * POST /api/orders/[id]/label
 *
 * (Re-)generates a prepaid return shipping label for an existing order.
 * Used by admins who need to regenerate a label after the fact.
 * Label generation at order-creation time is handled in /api/quote/order.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { generateShippingLabel } from "@/lib/easypost";

interface LabelRequestBody {
  sellerStreet: string;
  sellerCity: string;
  sellerState: string;
  sellerZip: string;
  sellerName: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: { tenant: { include: { napSettings: true } } },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (
    session.user.role !== UserRole.PLATFORM_ADMIN &&
    order.tenantId !== session.user.tenantId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nap = order.tenant.napSettings;
  if (!nap) {
    return NextResponse.json(
      { error: "Shop address (NAP settings) not configured. Set it in Settings → Business Info." },
      { status: 422 }
    );
  }

  const body: LabelRequestBody = await req.json();
  const { sellerStreet, sellerCity, sellerState, sellerZip, sellerName } = body;

  if (!sellerStreet || !sellerCity || !sellerState || !sellerZip) {
    return NextResponse.json({ error: "Seller address is required" }, { status: 400 });
  }

  try {
    const label = await generateShippingLabel(
      { name: sellerName, street1: sellerStreet, city: sellerCity, state: sellerState, zip: sellerZip },
      { name: nap.businessName, street1: nap.streetAddress, city: nap.city, state: nap.state, zip: nap.zipCode }
    );

    await db.order.update({
      where: { id: params.id },
      data: {
        shippingLabelUrl: label.labelUrl,
        trackingNumber:   label.trackingNumber,
        carrierName:      label.carrier,
      },
    });

    return NextResponse.json(label);
  } catch (err) {
    console.error("[EasyPost]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate label" },
      { status: 500 }
    );
  }
}
