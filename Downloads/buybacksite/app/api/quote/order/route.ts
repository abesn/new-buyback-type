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

  // ── Create ONE order with all devices as OrderItem rows ──────────────────────
  const orderNumber = await generateOrderNumber(tenantId);
  const totalPrice  = verified.reduce((s, r) => s + Number(r.buyPrice), 0);

  await db.order.create({
    data: {
      tenantId,
      orderNumber,
      sellerName:       sellerName.trim(),
      sellerEmail:      sellerEmail.trim().toLowerCase(),
      sellerPhone:      sellerPhone?.trim()   || null,
      quotedPrice:      totalPrice,
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
            ? `Order created via quote wizard (${items.length} devices)`
            : "Order created via quote wizard",
        },
      },
      items: {
        create: verified.map((row) => ({
          variantId:   row.variantId,
          conditionId: row.conditionId,
          quotedPrice: row.buyPrice,
        })),
      },
    },
  });

  // Build a summary of all devices for emails and the response
  const deviceItems = verified.map((row) => {
    const storageGb  = row.variant.storageGb;
    const carrier    = row.variant.carrier;
    const storageLabel = storageGb >= 1024 ? "1TB" : `${storageGb}GB`;
    const carrierLabel = carrier === "UNLOCKED" ? "Unlocked" : carrier.replace("TMOBILE", "T-Mobile");
    return {
      variantId:     row.variantId,
      conditionId:   row.conditionId,
      deviceName:    row.variant.model.name,
      storageGb,
      carrier,
      conditionLabel: row.condition.label,
      quotedPrice:   Number(row.buyPrice),
      // Short label for email device list
      summary: `${row.variant.model.name} ${storageLabel} · ${carrierLabel} · ${row.condition.label}`,
    };
  });

  // ── Confirmation email (single email listing all devices) ────────────────────
  if (nap) {
    const firstDevice = deviceItems[0];
    await sendOrderConfirmation({
      to:             sellerEmail,
      sellerName,
      orderNumber,
      allOrders:      deviceItems.map((d) => ({
        orderNumber,               // same number on every row
        quotedPrice:  d.quotedPrice,
        deviceName:   d.deviceName,
        storageGb:    d.storageGb,
        carrier:      d.carrier,
        conditionLabel: d.conditionLabel,
      })),
      deviceSummary:  deviceItems.map((d) => d.summary),
      deviceName:     firstDevice.deviceName,
      storageGb:      firstDevice.storageGb,
      carrier:        firstDevice.carrier,
      conditionLabel: firstDevice.conditionLabel,
      quotedPrice:    totalPrice,
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
    });
  }

  // ── Shop owner alert ─────────────────────────────────────────────────────────
  const adminEmail = tenant.users[0]?.email;
  if (adminEmail) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://app.buybacksite.com";
    const firstDevice = deviceItems[0];
    await sendNewOrderAlert({
      to:            adminEmail,
      orderNumber,
      deviceName:    items.length > 1
        ? `${firstDevice.deviceName} + ${items.length - 1} more`
        : firstDevice.deviceName,
      storageGb:      firstDevice.storageGb,
      conditionLabel: firstDevice.conditionLabel,
      quotedPrice:    totalPrice,
      sellerName,
      sellerEmail,
      dashboardUrl:  `${baseUrl}/dashboard/orders`,
    });
  }

  return NextResponse.json(
    {
      orderNumber,
      totalPrice,
      items:  deviceItems,
      labelUrl,
      trackingNumber,
      carrierName,
    },
    { status: 201 }
  );
}
