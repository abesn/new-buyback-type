import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { OrderDetail } from "./order-detail";

export default async function OrderDetailPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const order = await db.order.findUnique({
    where: { orderNumber: params.orderNumber },
    include: {
      tenant: { include: { napSettings: true } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      items: {
        include: {
          variant: { include: { model: { include: { brand: true } } } },
          condition: true,
        },
      },
    },
  });

  if (!order) notFound();

  // Scope check
  if (
    session.user.role !== UserRole.PLATFORM_ADMIN &&
    order.tenantId !== session.user.tenantId
  ) {
    redirect("/dashboard/orders");
  }

  const serialized = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    sellerName: order.sellerName,
    sellerEmail: order.sellerEmail,
    sellerPhone: order.sellerPhone,
    deviceNotes: order.deviceNotes,
    quotedPrice: Number(order.quotedPrice),
    finalPrice: order.finalPrice != null ? Number(order.finalPrice) : null,
    payoutMethod: order.payoutMethod,
    payoutAddress: order.payoutAddress,
    payoutReference: order.payoutReference,
    paidAt: order.paidAt?.toISOString() ?? null,
    shippingLabelUrl: order.shippingLabelUrl,
    trackingNumber: order.trackingNumber,
    carrierName: order.carrierName,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    receivedAt: order.receivedAt?.toISOString() ?? null,
    internalNotes: order.internalNotes,
    rejectionReason: order.rejectionReason,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    tenantId: order.tenantId,
    tenantName: order.tenant.name,
    nap: order.tenant.napSettings
      ? {
          businessName: order.tenant.napSettings.businessName,
          phone: order.tenant.napSettings.phone,
        }
      : null,
    statusHistory: order.statusHistory.map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    items: order.items.map((item) => ({
      id: item.id,
      modelName: item.variant.model.name,
      brandName: item.variant.model.brand.name,
      storageGb: item.variant.storageGb,
      carrier: item.variant.carrier,
      conditionGrade: item.condition.grade,
      conditionLabel: item.condition.label,
      quotedPrice: Number(item.quotedPrice),
      finalPrice: item.finalPrice != null ? Number(item.finalPrice) : null,
    })),
  };

  return (
    <OrderDetail
      order={serialized}
      canEdit={session.user.role !== UserRole.STAFF}
    />
  );
}
