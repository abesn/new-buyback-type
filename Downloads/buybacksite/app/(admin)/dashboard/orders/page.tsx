import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole, OrderStatus } from "@prisma/client";
import { Suspense } from "react";
import { OrdersTable } from "./orders-table";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isPlatformAdmin = session.user.role === UserRole.PLATFORM_ADMIN;
  const tenantFilter = isPlatformAdmin ? {} : { tenantId: session.user.tenantId! };
  const status = searchParams.status as OrderStatus | undefined;
  const page = parseInt(searchParams.page ?? "1");
  const limit = 25;

  const where = {
    ...tenantFilter,
    ...(status ? { status } : {}),
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        tenant: { select: { name: true, slug: true } },
        items: {
          include: {
            variant: { include: { model: true } },
            condition: { select: { label: true, grade: true } },
          },
        },
      },
    }),
    db.order.count({ where }),
  ]);

  const statusCounts = await db.order.groupBy({
    by: ["status"],
    where: tenantFilter,
    _count: true,
  });

  const countByStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count])
  ) as Record<string, number>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total} order{total !== 1 ? "s" : ""} total</p>
      </div>

      <Suspense>
      <OrdersTable
        orders={orders.map((o) => ({
          ...o,
          quotedPrice: Number(o.quotedPrice),
          finalPrice: o.finalPrice != null ? Number(o.finalPrice) : null,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
          shippedAt: o.shippedAt?.toISOString() ?? null,
          receivedAt: o.receivedAt?.toISOString() ?? null,
          paidAt: o.paidAt?.toISOString() ?? null,
          items: o.items.map((item) => ({
            deviceName: item.variant.model.name,
            storageGb: item.variant.storageGb,
            carrier: item.variant.carrier,
            conditionLabel: item.condition.label,
            grade: item.condition.grade,
            quotedPrice: Number(item.quotedPrice),
          })),
        }))}
        total={total}
        page={page}
        pages={Math.ceil(total / limit)}
        statusCounts={countByStatus}
        currentStatus={status}
        isPlatformAdmin={isPlatformAdmin}
      />
      </Suspense>
    </div>
  );
}
