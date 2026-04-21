import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole, OrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as OrderStatus | null;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 25;

  const tenantFilter =
    session.user.role === UserRole.PLATFORM_ADMIN
      ? {}
      : { tenantId: session.user.tenantId! };

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
      },
    }),
    db.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
}
