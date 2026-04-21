import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { PayoutMethod } from "@prisma/client";
import { sendOrderConfirmation, sendNewOrderAlert } from "@/lib/email";
import { generateShippingLabel } from "@/lib/easypost";

// ─── Request body ──────────────────────────────────────────────────────────────

interface OrderItem {
  variantId: string;
  conditionId: string;
}

interface CreateOrderBody {
  tenantId: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone?: string;
  payoutMethod: PayoutMethod;
  payoutAddress: string;
  deviceNotes?: string;
  // Seller address — used to generate prepaid shipping label
  sellerStreet: string;
  sellerCity: string;
  sellerState: string;
  sellerZip: string;
  // One or more devices being sold in this shipment
  items: OrderItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const count = await db.order.count({ where: { tenantId } });
    const num = String(count + 1 + i).padStart(4, "0");
    const candidate = `BB-${year}-${num}`;
    const conflict = await db.order.findUnique({ where: { orderNumber: candidate } });
    if (!conflict) return candidate;
  }
  return `BB-${Date.now().toString(36).toUpperCase()}`;
}

// ─── POST /api/quote/order ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: CreateOrderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    tenantId, sellerName, sellerEmail, sellerPhone,
    payoutMethod, payoutAddress, deviceNotes,
    sellerStreet, sellerCity, sellerState, sellerZip,
    items,
  } = body;

  if (!tenantId || !sellerName || !sellerEmail || !payoutMethod || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sellerEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // ── Verify tenant ────────────────────────────────────────────────────────────
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId, status: { in: ["TRIAL", "ACTIVE"] } },
    include: {
      napSettings: true,
      users: { where: { role: "TENANT_ADMIN" }, select: { email: true } },
    },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found or inactive" }, { status: 404 });
  }

  // ── Verify all prices from DB (never trust client-sent prices) ───────────────
  const priceRows = await Promise.all(
    items.map(({ variantId, conditionId }) =>
      db.buybackPrice.findUnique({
        where: { tenantId_variantId_conditionId: { tenantId, variantId, conditionId } },
        include: { variant: { include: { model: true } }, condition: true },
      })
    )
  );

  const missing = priceRows.findIndex((p) => !p);
  if (missing !== -1) {
    return NextResponse.json(
      { error: `Price not found for item ${missing + 1}` },
      { status: 404 }
    );
  }

  const verified = priceRows as NonNullable<(typeof priceRows)[number]>[];
  const nap = tenant.napSettings;

  // ── Generate one prepaid shipping label for the whole shipment ───────────────
  let labelUrl: string | null = null;
  let trackingNumber: string | null = null;
  let carrierName: string | null = null;

  if (nap && sellerStreet && sellerCity && sellerState && sellerZip) {
    try {
      const label = await generateShippingLabel(
        { name: sellerName,       street1: sellerStreet, city: sellerCity, state: sellerState, zip: sellerZip },
        { name: nap.businessName, street1: nap.streetAddress, city: nap.city, state: nap.state, zip: nap.zipCode }
      );
      labelUrl       = label.labelUrl;
      trackingNumber = label.trackingNumber;
      carrierName    = label.carrier;
    } catch (err) {
      console.error("[order] Label generation failed:", err);
      // Non-fatal — order still gets created
    }
  }

  // ── Create one order per device (all share the same label) ───────────────────
  const createdOrders: {
    orderNumber: string;
    quotedPrice: number;
    deviceName: string;
    storageGb: number;
    carrier: string;
    conditionLabel: string;
  }[] = [];

  for (const row of verified) {
    const orderNumber = await generateOrderNumber(tenantId);
    const quotedPrice = Number(row.buyPrice);

    await db.order.create({
      data: {
        tenantId,
        orderNumber,
        sellerName:       sellerName.trim(),
        sellerEmail:      sellerEmail.trim().toLowerCase(),
        sellerPhone:      sellerPhone?.trim()   || null,
        variantId:        row.variantId,
        conditionId:      row.conditionId,
        quotedPrice,
        payoutMethod,
        payoutAddress:    payoutAddress?.trim() || null,
        deviceNotes:      deviceNotes?.trim()   || null,
        shippingLabelUrl: labelUrl,
        trackingNumber,
        carrierName,
        status: "PENDING",
        statusHistory: {
          create: {
            status: "PENDING",
            note: items.length > 1
              ? `Order created via quote wizard (batch of ${items.length} devices)`
              : "Order created via quote wizard",
          },
        },
      },
    });

    createdOrders.push({
      orderNumber,
      quotedPrice,
      deviceName:     row.variant.model.name,
      storageGb:      row.variant.storageGb,
      carrier:        row.variant.carrier,
      conditionLabel: row.condition.label,
    });
  }

  const totalPrice = createdOrders.reduce((s, o) => s + o.quotedPrice, 0);
  const firstOrder = createdOrders[0];

  // ── Confirmation email (single email listing all devices) ────────────────────
  if (nap) {
    const deviceSummary = createdOrders.map((o) => {
      const storage = o.storageGb >= 1024 ? "1TB" : `${o.storageGb}GB`;
      const carrier = o.carrier === "UNLOCKED" ? "Unlocked" : o.carrier.replace("TMOBILE", "T-Mobile");
      return `${o.deviceName} ${storage} · ${carrier} · ${o.conditionLabel}`;
    });

    await sendOrderConfirmation({
      to:              sellerEmail,
      sellerName,
      // Use first order number as the reference; all are listed in the email body
      orderNumber:     firstOrder.orderNumber,
      allOrders:       createdOrders,
      deviceName:      firstOrder.deviceName,
      storageGb:       firstOrder.storageGb,
      carrier:         firstOrder.carrier,
      conditionLabel:  firstOrder.conditionLabel,
      quotedPrice:     totalPrice,
      payoutMethod,
      shippingName:    nap.businessName,
      shippingAddress: nap.streetAddress,
      shippingCity:    nap.city,
      shippingState:   nap.state,
      shippingZip:     nap.zipCode,
      shopName:        tenant.name,
      shopPhone:       nap.phone,
      labelUrl:        labelUrl    ?? undefined,
      trackingNumber:  trackingNumber ?? undefined,
      deviceSummary,
    });
  }

  // ── Shop owner alert ─────────────────────────────────────────────────────────
  const adminEmail = tenant.users[0]?.email;
  if (adminEmail) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://app.buybacksite.com";
    await sendNewOrderAlert({
      to:             adminEmail,
      orderNumber:    firstOrder.orderNumber,
      deviceName:     items.length > 1
        ? `${firstOrder.deviceName} + ${items.length - 1} more`
        : firstOrder.deviceName,
      storageGb:       firstOrder.storageGb,
      conditionLabel:  firstOrder.conditionLabel,
      quotedPrice:     totalPrice,
      sellerName,
      sellerEmail,
      dashboardUrl:   `${baseUrl}/dashboard/orders`,
    });
  }

  return NextResponse.json(
    {
      orders: createdOrders,
      totalPrice,
      labelUrl,
      trackingNumber,
      carrierName,
    },
    { status: 201 }
  );
}
