import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole, TenantPlan, TenantStatus, PricingRuleScope } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, orders: true } },
    },
  });

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, slug, plan, adminEmail, adminName } = body as {
    name: string;
    slug: string;
    plan: TenantPlan;
    adminEmail: string;
    adminName?: string;
  };

  if (!name || !slug || !adminEmail) {
    return NextResponse.json({ error: "name, slug, and adminEmail are required" }, { status: 400 });
  }

  const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const existing = await db.tenant.findUnique({ where: { slug: slugClean } });
  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const tenant = await db.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: {
        name,
        slug: slugClean,
        plan: plan ?? TenantPlan.STARTER,
        status: TenantStatus.TRIAL,
        trialEndsAt,
      },
    });

    await tx.user.upsert({
      where: { email: adminEmail },
      update: { role: UserRole.TENANT_ADMIN, tenantId: t.id, name: adminName },
      create: {
        email: adminEmail,
        name: adminName,
        role: UserRole.TENANT_ADMIN,
        tenantId: t.id,
      },
    });

    await tx.pricingRule.create({
      data: { tenantId: t.id, scope: PricingRuleScope.GLOBAL, marginPercent: 0.65 },
    });

    return t;
  });

  return NextResponse.json(tenant, { status: 201 });
}
