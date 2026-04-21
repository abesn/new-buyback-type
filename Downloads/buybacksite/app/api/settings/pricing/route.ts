import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole, PricingRuleScope } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === UserRole.STAFF) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tenantId, marginPercent } = await req.json() as { tenantId: string; marginPercent: number };

  if (session.user.role !== UserRole.PLATFORM_ADMIN && session.user.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clamped = Math.min(0.9, Math.max(0.1, marginPercent));

  const existing = await db.pricingRule.findFirst({
    where: { tenantId, scope: PricingRuleScope.GLOBAL, scopeId: null },
  });

  const rule = existing
    ? await db.pricingRule.update({ where: { id: existing.id }, data: { marginPercent: clamped } })
    : await db.pricingRule.create({ data: { tenantId, scope: PricingRuleScope.GLOBAL, marginPercent: clamped } });

  return NextResponse.json(rule);
}
