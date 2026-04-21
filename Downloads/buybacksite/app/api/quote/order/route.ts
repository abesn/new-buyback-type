import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { PayoutMethod } from "@prisma/client";
import { sendOrderConfirmation, sendNewOrderAlert } from "@/lib/email";

interface CreateOrderBody {
  tenantId: string;
  variantId: string;
  conditionId: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone?: string;
  payoutMethod: PayoutMethod;
  payoutAddress: string;
  deviceNotes?: string;
}

async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const count = await db.order.count({ where: { tenantId } });
    const num = String(count + 1 + i).padStart(4, "0");
    const candidate = `BB-${year}-${num}`;
    const conflict = await db.order.findUnique({ where: { orderNumber: candidate } });
    if (!conflict) return candidate;
  }
  // Fallback: use timestamp
  return `BB-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  let body: CreateOrderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    tenantId, variantId, conditionId,
    sellerName, sellerEmail, sellerPhone,
    payoutMethod, payoutAddress, deviceNotes,
  } = body;

  if (!tenantId || !variantId || !conditionId || !sellerName || !sellerEmail || !payoutMethod) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sellerEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Verify tenant is active
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId, status: { in: ["TRIAL", "ACTIVE"] } },
    include: { napSettings: true, users: { where: { role: "TENANT_ADMIN" }, select: { email: true } } },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found or inactive" }, { status: 404 });
  }

  // Look up the verified price from DB (don't trust client-sent price)
  const priceRow = await db.buybackPrice.findUnique({
    where: { tenantId_variantId_conditionId: { tenantId, variantId, conditionId } },
    include: {
      variant: { include: { model: true } },
      condition: true,
    },
  });

  if (!priceRow) {
    return NextResponse.json({ error: "Price not found for this device/condition" }, { status: 404 });
  }

  const orderNumber = await generateOrderNumber(tenantId);
  const quotedPrice = Number(priceRow.buyPrice);
  const variant = priceRow.variant;
  const condition = priceRow.condition;

  // Create order + initial status history
  const order = await db.order.create({
    data: {
      tenantId,
      orderNumber,
      sellerName: sellerName.trim(),
      sellerEmail: sellerEmail.trim().toLowerCase(),
      sellerPhone: sellerPhone?.trim() || null,
      variantId,
      conditionId,
      quotedPrice,
      payoutMethod,
      payoutAddress: payoutAddress?.trim() || null,
      deviceNotes: deviceNotes?.trim() || null,
      status: "PENDING",
      statusHistory: {
        create: {
          status: "PENDING",
          note: "Order created via quote wizard",
        },
      },
    },
  });

  // Send confirmation email to seller
  const nap = tenant.napSettings;
  if (nap) {
    await sendOrderConfirmation({
      to: sellerEmail,
      sellerName,
      orderNumber,
      deviceName: variant.model.name,
      storageGb: variant.storageGb,
      carrier: variant.carrier,
      conditionLabel: condition.label,
      quotedPrice,
      payoutMethod,
      shippingName: nap.businessName,
      shippingAddress: nap.streetAddress,
      shippingCity: nap.city,
      shippingState: nap.state,
      shippingZip: nap.zipCode,
      shopName: tenant.name,
      shopPhone: nap.phone,
    });
  }

  // Alert shop owner
  const adminEmail = tenant.users[0]?.email;
  if (adminEmail) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://app.buybacksite.com";
    await sendNewOrderAlert({
      to: adminEmail,
      orderNumber,
      deviceName: variant.model.name,
      storageGb: variant.storageGb,
      conditionLabel: condition.label,
      quotedPrice,
      sellerName,
      sellerEmail,
      dashboardUrl: `${baseUrl}/dashboard/orders`,
    });
  }

  return NextResponse.json(
    {
      orderNumber: order.orderNumber,
      quotedPrice,
      deviceName: variant.model.name,
      storageGb: variant.storageGb,
      carrier: variant.carrier,
      conditionLabel: condition.label,
    },
    { status: 201 }
  );
}
