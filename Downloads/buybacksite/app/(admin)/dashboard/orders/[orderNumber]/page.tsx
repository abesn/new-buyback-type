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

  const [variant, condition] = await Promise.all([
    db.deviceVariant.findUnique({
      where: { id: order.variantId },
      include: { model: { include: { brand: true } } },
    }),
    db.deviceCondition.findUnique({ where: { id: order.conditionId } }),
  ]);

  const serialized = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    sellerName: order.sellerName,
    sellerEmail: order.sellerEmail,
    sellerPhone: order.sellerPhone,
    variantId: order.variantId,
    conditionId: order.conditionId,
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
    device: variant
      ? {
          modelName: variant.model.name,
          brandName: variant.model.brand.name,
          storageGb: variant.storageGb,
          carrier: variant.carrier,
        }
      : null,
    condition: condition
      ? { grade: condition.grade, label: condition.label }
      : null,
  };

  return (
    <OrderDetail
      order={serialized}
      canEdit={session.user.role !== UserRole.STAFF}
    />
  );
}
