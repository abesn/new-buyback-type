import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { OrderStatus, UserRole } from "@prisma/client";
import { sendStatusEmail } from "@/lib/email";

// ─── Valid status transitions ──────────────────────────────────────────────────

const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING:       [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED:       [OrderStatus.RECEIVED, OrderStatus.CANCELLED],
  RECEIVED:      [OrderStatus.INSPECTING],
  INSPECTING:    [OrderStatus.APPROVED, OrderStatus.OFFER_REVISED, OrderStatus.REJECTED],
  OFFER_REVISED: [OrderStatus.APPROVED, OrderStatus.REJECTED],
  APPROVED:      [OrderStatus.PAID],
  REJECTED:      [OrderStatus.RETURNED],
};

// Statuses that auto-set a timestamp field
const TIMESTAMP_FIELDS: Partial<Record<OrderStatus, string>> = {
  SHIPPED:  "shippedAt",
  RECEIVED: "receivedAt",
  PAID:     "paidAt",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      tenant: { include: { napSettings: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Scope check: staff/tenant admin can only see their own tenant's orders
  if (
    session.user.role !== UserRole.PLATFORM_ADMIN &&
    order.tenantId !== session.user.tenantId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(order);
}

// ─── PATCH — update order (status transition, notes, payout) ──────────────────

interface PatchBody {
  action: "transition" | "notes" | "payout";
  // transition
  status?: OrderStatus;
  note?: string;
  finalPrice?: number;
  trackingNumber?: string;
  carrierName?: string;
  rejectionReason?: string;
  // notes
  internalNotes?: string;
  // payout
  payoutReference?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      tenant: {
        include: {
          napSettings: true,
          users: { where: { role: "TENANT_ADMIN" }, select: { email: true } },
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    session.user.role !== UserRole.PLATFORM_ADMIN &&
    order.tenantId !== session.user.tenantId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: PatchBody = await req.json();

  // ── Action: save internal notes ──────────────────────────────────────────────
  if (body.action === "notes") {
    const updated = await db.order.update({
      where: { id: params.id },
      data: { internalNotes: body.internalNotes ?? null },
    });
    return NextResponse.json(updated);
  }

  // ── Action: record payout reference ─────────────────────────────────────────
  if (body.action === "payout") {
    const updated = await db.order.update({
      where: { id: params.id },
      data: {
        payoutReference: body.payoutReference ?? null,
        paidAt: new Date(),
        status: OrderStatus.PAID,
        statusHistory: {
          create: {
            status: OrderStatus.PAID,
            note: body.note ?? "Payment sent",
            changedBy: session.user.id,
          },
        },
      },
    });

    // Notify seller
    await notifySeller(order, OrderStatus.PAID, {
      finalPrice: Number(order.finalPrice ?? order.quotedPrice),
      payoutMethod: order.payoutMethod,
      payoutReference: body.payoutReference ?? "",
    });

    return NextResponse.json(updated);
  }

  // ── Action: status transition ────────────────────────────────────────────────
  if (body.action === "transition") {
    const newStatus = body.status;
    if (!newStatus) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${order.status} to ${newStatus}` },
        { status: 422 }
      );
    }

    // Build update data
    const data: Record<string, unknown> = { status: newStatus };

    // Auto-set timestamp fields
    const tsField = TIMESTAMP_FIELDS[newStatus];
    if (tsField) data[tsField] = new Date();

    // Optional fields per transition
    if (body.trackingNumber) data.trackingNumber = body.trackingNumber;
    if (body.carrierName)    data.carrierName = body.carrierName;
    if (body.rejectionReason) data.rejectionReason = body.rejectionReason;
    if (body.finalPrice !== undefined) data.finalPrice = body.finalPrice;

    const updated = await db.order.update({
      where: { id: params.id },
      data: {
        ...data,
        statusHistory: {
          create: {
            status: newStatus,
            note: body.note ?? undefined,
            changedBy: session.user.id,
          },
        },
      },
    });

    // Notify seller of meaningful transitions
    const notifyStatuses: OrderStatus[] = [
      OrderStatus.RECEIVED,
      OrderStatus.OFFER_REVISED,
      OrderStatus.APPROVED,
      OrderStatus.REJECTED,
      OrderStatus.RETURNED,
    ];
    if (notifyStatuses.includes(newStatus)) {
      await notifySeller(order, newStatus, {
        finalPrice: body.finalPrice ?? Number(order.finalPrice ?? order.quotedPrice),
        note: body.note,
        trackingNumber: body.trackingNumber,
        carrierName: body.carrierName,
      });
    }

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function notifySeller(
  order: {
    id: string;
    sellerEmail: string;
    sellerName: string;
    orderNumber: string;
    payoutMethod: string;
    quotedPrice: unknown;
    finalPrice: unknown;
    tenant: {
      name: string;
      napSettings: { phone: string } | null;
    };
  },
  status: OrderStatus,
  extra: Record<string, string | number | undefined>
) {
  // Fetch device name from the first OrderItem
  const firstItem = await db.orderItem.findFirst({
    where: { orderId: order.id },
    include: { variant: { include: { model: true } } },
    orderBy: { id: "asc" },
  });
  const variant = firstItem?.variant ?? null;

  await sendStatusEmail(status, {
    to: order.sellerEmail,
    sellerName: order.sellerName,
    orderNumber: order.orderNumber,
    deviceName: variant?.model.name ?? "your device",
    shopName: order.tenant.name,
    shopPhone: order.tenant.napSettings?.phone ?? "",
  }, {
    ...Object.fromEntries(
      Object.entries(extra).filter(([, v]) => v !== undefined)
    ) as Record<string, string | number>,
    payoutMethod: order.payoutMethod,
    quotedPrice: Number(order.quotedPrice),
  });
}
