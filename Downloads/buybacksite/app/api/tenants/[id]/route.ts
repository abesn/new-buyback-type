import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole, TenantPlan, TenantStatus } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id: params.id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
      napSettings: true,
      domainSettings: true,
      _count: { select: { orders: true } },
    },
  });

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tenant);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    name?: string;
    plan?: TenantPlan;
    status?: TenantStatus;
  };

  const tenant = await db.tenant.update({
    where: { id: params.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.plan && { plan: body.plan }),
      ...(body.status && { status: body.status }),
    },
  });

  return NextResponse.json(tenant);
}
